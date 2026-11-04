"""
SAM2 and YOLO11 Wound Segmentation Wrapper
Lead: Adreesh Mitra

Integrates Ultralytics YOLO11 automatic wound detection with fine-tuned SAM2
Global-Local dual inference for clinical-grade wound boundary segmentation.
"""

import os
import sys
import cv2
import urllib.request
import numpy as np
from pathlib import Path
from typing import Dict, Any, Optional, Tuple, List

# PyTorch
try:
    import torch
    import torch.nn.functional as F
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False

# SAM2
try:
    from sam2.build_sam import build_sam2
    from sam2.sam2_image_predictor import SAM2ImagePredictor
    SAM2_AVAILABLE = True
except ImportError:
    SAM2_AVAILABLE = False

# YOLO (Ultralytics)
try:
    from ultralytics import YOLO
    YOLO_AVAILABLE = True
except ImportError:
    YOLO_AVAILABLE = False


META_BASE_SAM2_URL = "https://dl.fbaipublicfiles.com/segment_anything_2/072824/sam2_hiera_small.pt"


class SAM2WoundSegmentor:
    """
    Production segmentation engine integrating YOLO11 detection with
    fine-tuned SAM2 Global-Local dual inference.
    """

    def __init__(
        self,
        yolo_path: Optional[str] = None,
        sam2_weights: Optional[str] = None,
        sam2_cfg: str = "configs/sam2/sam2_hiera_s.yaml",
        base_sam2_pt: Optional[str] = None,
        device: str = "auto",
        auto_download_base: bool = True,
    ):
        if not TORCH_AVAILABLE:
            self.device = "cpu"
        elif device == "auto":
            self.device = "cuda" if torch.cuda.is_available() else "cpu"
        else:
            self.device = device

        # Determine models/sam2 folder relative to repository root
        root = Path(__file__).resolve().parents[2]
        sam2_dir = root / "models" / "sam2"
        sam2_dir.mkdir(parents=True, exist_ok=True)

        self.yolo_path = yolo_path or str(sam2_dir / "yolo11s_wound_best.pt")
        self.sam2_weights = sam2_weights or str(sam2_dir / "sam2_wound_combined_finetuned.pth")
        self.base_sam2_pt = base_sam2_pt or str(sam2_dir / "sam2_hiera_small.pt")
        self.sam2_cfg = sam2_cfg
        self.auto_download_base = auto_download_base

        self.detector = None
        self.predictor = None
        self.is_ready = False

        self._load_models()

    def _ensure_base_weights(self) -> bool:
        """Verifies or auto-downloads official base SAM2 checkpoint from Meta."""
        if os.path.exists(self.base_sam2_pt):
            return True
        if not self.auto_download_base:
            return False

        print(f"[SAM2 SETUP] sam2_hiera_small.pt not found. Downloading from Meta AI...")
        try:
            os.makedirs(os.path.dirname(self.base_sam2_pt), exist_ok=True)
            urllib.request.urlretrieve(META_BASE_SAM2_URL, self.base_sam2_pt)
            print(f"[SAM2 SETUP] Successfully downloaded base checkpoint to {self.base_sam2_pt}")
            return True
        except Exception as e:
            print(f"[SAM2 ERROR] Failed to download base weights: {e}")
            return False

    def _load_models(self):
        """Initializes and loads YOLO11 and SAM2 models."""
        if not TORCH_AVAILABLE:
            print("[SAM2 WARNING] PyTorch is not available.")
            return

        # 1. Load YOLO11 detector
        if YOLO_AVAILABLE and os.path.exists(self.yolo_path):
            try:
                self.detector = YOLO(self.yolo_path)
                print(f"[YOLO MODEL] Wound detector loaded from {self.yolo_path}")
            except Exception as e:
                print(f"[YOLO ERROR] Could not load YOLO model: {e}")
        else:
            if not YOLO_AVAILABLE:
                print("[YOLO NOTICE] ultralytics package not installed.")
            elif not os.path.exists(self.yolo_path):
                print(f"[YOLO NOTICE] Checkpoint not found at {self.yolo_path}")

        # 2. Load SAM2 model
        if SAM2_AVAILABLE:
            base_ok = self._ensure_base_weights()
            if base_ok and os.path.exists(self.sam2_weights):
                try:
                    sam2_model = build_sam2(self.sam2_cfg, self.base_sam2_pt, device=self.device)
                    sam2_model.load_state_dict(
                        torch.load(self.sam2_weights, map_location=self.device)
                    )
                    sam2_model.eval()
                    self.predictor = SAM2ImagePredictor(sam2_model)
                    print(f"[SAM2 MODEL] Fine-tuned SAM2 loaded from {self.sam2_weights} on {self.device}")
                except Exception as e:
                    print(f"[SAM2 ERROR] Could not load SAM2 weights: {e}")
            else:
                if not os.path.exists(self.sam2_weights):
                    print(f"[SAM2 NOTICE] Fine-tuned weights not found at {self.sam2_weights}")
        else:
            print("[SAM2 NOTICE] segment-anything-2 package not installed.")

        self.is_ready = (self.detector is not None and self.predictor is not None)

    def _predict_single(
        self,
        image_rgb: np.ndarray,
        box: List[int],
        interior_pt: List[int],
    ) -> np.ndarray:
        """
        Runs SAM2 inference on an image region with geometric penalty ranker.
        """
        self.predictor.set_image(image_rgb)
        x1, y1, x2, y2 = box
        box_area = max((x2 - x1) * (y2 - y1), 1)

        masks, scores, _ = self.predictor.predict(
            point_coords=np.array([interior_pt], dtype=np.float32),
            point_labels=np.array([1], dtype=np.int32),
            box=np.array(box, dtype=np.float32)[None, :],
            multimask_output=True,
        )

        box_mask = np.zeros(image_rgb.shape[:2], dtype=bool)
        box_mask[int(y1):int(y2), int(x1):int(x2)] = True

        best_score = -1e9
        selected = None

        for mask, sam_score in zip(masks, scores):
            binary_m = mask > 0.0
            mask_area = np.sum(binary_m)
            if mask_area == 0:
                continue
            fill_ratio = mask_area / box_area
            leak_ratio = np.sum(binary_m & (~box_mask)) / (mask_area + 1e-5)

            geom_penalty = 0.0
            if fill_ratio < 0.16:
                geom_penalty += (0.16 - fill_ratio) * 6.0
            if fill_ratio > 0.85:
                geom_penalty += (fill_ratio - 0.85) * 6.0
            geom_penalty += leak_ratio * 4.0

            final_rank = sam_score - geom_penalty
            if final_rank > best_score:
                best_score = final_rank
                selected = binary_m

        if selected is not None:
            return selected.astype(np.uint8)
        return (masks[1] > 0.0).astype(np.uint8)

    def segment_global_local(
        self,
        full_image_rgb: np.ndarray,
        box: List[int],
        interior_pt: List[int],
    ) -> np.ndarray:
        """
        WSNet-style Global-Local dual inference.
        
        GLOBAL PASS: Full image — captures macro anatomy and lesion position.
        LOCAL PASS:  Zoomed-in crop around lesion — captures fine wound margins.
        FUSION:      Logical OR of both passes mapped back to image space.
        """
        H, W = full_image_rgb.shape[:2]
        x1, y1, x2, y2 = [int(c) for c in box]

        # 1. Global Pass
        global_mask = self._predict_single(full_image_rgb, box, interior_pt)

        # 2. Local Pass (Padded Crop)
        pad = max(20, int(0.15 * max(x2 - x1, y2 - y1)))
        lx1 = max(0, x1 - pad)
        ly1 = max(0, y1 - pad)
        lx2 = min(W, x2 + pad)
        ly2 = min(H, y2 + pad)

        wound_crop = full_image_rgb[ly1:ly2, lx1:lx2]
        crop_h, crop_w = wound_crop.shape[:2]
        if crop_h < 10 or crop_w < 10:
            return global_mask

        wound_upsampled = cv2.resize(wound_crop, (W, H), interpolation=cv2.INTER_LINEAR)

        scale_x = W / crop_w
        scale_y = H / crop_h
        local_box = [
            (x1 - lx1) * scale_x,
            (y1 - ly1) * scale_y,
            (x2 - lx1) * scale_x,
            (y2 - ly1) * scale_y,
        ]
        local_pt = [
            (interior_pt[0] - lx1) * scale_x,
            (interior_pt[1] - ly1) * scale_y,
        ]

        local_mask_upsampled = self._predict_single(wound_upsampled, local_box, local_pt)

        # Remap local mask back to original coordinate space
        local_mask_remapped = np.zeros((H, W), dtype=np.uint8)
        local_region = cv2.resize(
            local_mask_upsampled,
            (lx2 - lx1, ly2 - ly1),
            interpolation=cv2.INTER_NEAREST,
        )
        local_mask_remapped[ly1:ly2, lx1:lx2] = local_region

        # 3. Fusion: Union of Global and Local views
        return np.logical_or(global_mask, local_mask_remapped).astype(np.uint8)

    def predict(
        self,
        image_bgr: np.ndarray,
        conf_thresh: float = 0.15,
    ) -> Tuple[np.ndarray, List[List[int]]]:
        """
        Full autonomous pipeline:
        1. OpenCV Clinical Preprocessing
        2. YOLO11 Wound Detection (with multi-tier sensitivity)
        3. SAM2 Global-Local Dual Inference
        
        Returns:
            Tuple of (binary_mask_uint8, list_of_detected_boxes)
        """
        if not self.is_ready:
            return np.zeros(image_bgr.shape[:2], dtype=np.uint8), []

        H, W = image_bgr.shape[:2]

        # ── Step 1: Preprocessing ─────────────────────────────────────────────
        lab = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2LAB)
        _, glare = cv2.threshold(lab[:, :, 0], 235, 255, cv2.THRESH_BINARY)
        if cv2.countNonZero(glare) > 0:
            deglared = cv2.inpaint(image_bgr, glare, 3, cv2.INPAINT_TELEA)
        else:
            deglared = image_bgr

        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        lab_deglared = cv2.cvtColor(deglared, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab_deglared)
        l_enhanced = clahe.apply(l)
        enhanced_bgr = cv2.cvtColor(cv2.merge((l_enhanced, a, b)), cv2.COLOR_LAB2BGR)
        filtered_bgr = cv2.bilateralFilter(enhanced_bgr, d=5, sigmaColor=40, sigmaSpace=40)
        clean_rgb = cv2.cvtColor(filtered_bgr, cv2.COLOR_BGR2RGB)

        # ── Step 2: YOLO11 Detection with Adaptive Sensitivity ────────────────
        yolo_res = self.detector.predict(
            deglared,
            conf=conf_thresh,
            imgsz=512,
            augment=True,
            verbose=False,
        )[0]

        boxes = yolo_res.boxes.xyxy.cpu().numpy()

        # If no boxes at primary threshold, try high-sensitivity pass
        if len(boxes) == 0 and conf_thresh > 0.08:
            yolo_res = self.detector.predict(
                deglared,
                conf=0.08,
                imgsz=512,
                augment=True,
                verbose=False,
            )[0]
            boxes = yolo_res.boxes.xyxy.cpu().numpy()

        # If still no box, fall back to center crop prompt so SAM2 ALWAYS segments
        if len(boxes) == 0:
            pad_w = int(0.12 * W)
            pad_h = int(0.12 * H)
            fallback_box = [pad_w, pad_h, W - pad_w, H - pad_h]
            boxes = np.array([fallback_box])

        # ── Step 3: SAM2 Global-Local per Detected Box ────────────────────────
        combined_mask = np.zeros((H, W), dtype=np.uint8)
        detected_boxes = []

        for box in boxes:
            x1, y1, x2, y2 = box.astype(int)
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(W, x2), min(H, y2)

            if (x2 - x1) < 5 or (y2 - y1) < 5:
                continue

            cx = int((x1 + x2) / 2)
            cy = int((y1 + y2) / 2)

            lesion_mask = self.segment_global_local(clean_rgb, [x1, y1, x2, y2], [cx, cy])
            if lesion_mask is not None:
                combined_mask = np.logical_or(combined_mask, lesion_mask).astype(np.uint8)
            detected_boxes.append([x1, y1, x2, y2])

        return combined_mask, detected_boxes

"""
Test and Verification Script for YOLO11 + SAM2 Wound Segmentation Pipeline
Lead: Adreesh Mitra
"""

import os
import sys
import cv2
import base64
import numpy as np
from pathlib import Path

# Add project root to sys.path
root_dir = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root_dir))

from cv.segmentation.wound_segmentation import segment_and_measure_wound, get_segmentor


def main():
    print("=" * 70)
    print(" DIABETESCARE AI - WOUND SEGMENTATION MODEL VERIFICATION")
    print("=" * 70)

    # 1. Check Model Checkpoint Files
    sam2_dir = root_dir / "models" / "sam2"
    yolo_file = sam2_dir / "yolo11s_wound_best.pt"
    sam2_ft_file = sam2_dir / "sam2_wound_combined_finetuned.pth"
    sam2_base_file = sam2_dir / "sam2_hiera_small.pt"

    print("\n[1] Checking Model Checkpoints in models/sam2/:")
    for f in [yolo_file, sam2_ft_file, sam2_base_file]:
        if f.exists():
            size_mb = f.stat().st_size / (1024 * 1024)
            print(f"  [FOUND] {f.name:<36} ({size_mb:.1f} MB)")
        else:
            print(f"  [MISSING] {f.name:<36}")

    # 2. Check Segmentor Status
    print("\n[2] Initializing Segmentor Engine:")
    seg = get_segmentor()
    if seg is not None:
        print(f"  - Detector loaded:  {seg.detector is not None}")
        print(f"  - SAM2 Predictor:   {seg.predictor is not None}")
        print(f"  - Device selected:  {getattr(seg, 'device', 'cpu')}")
        print(f"  - Full AI Ready:    {seg.is_ready}")
    else:
        print("  - Segmentor running in OpenCV fallback mode")

    # 3. Test on a Sample Wound Image
    print("\n[3] Running Inference on Test Image:")
    test_photo = root_dir / "stored_photos" / "PAT_KGP_01_VIS_004_measurement_20261001_200842.jpg"
    
    if test_photo.exists():
        img_bgr = cv2.imread(str(test_photo))
        print(f"  - Loaded patient test photo: {test_photo.name} ({img_bgr.shape})")
    else:
        print("  - Generating synthetic test photo...")
        img_bgr = np.full((512, 512, 3), 160, dtype=np.uint8)
        cv2.ellipse(img_bgr, (256, 256), (90, 65), 25, 0, 360, (40, 40, 190), -1)
        cv2.circle(img_bgr, (256, 256), 40, (30, 30, 130), -1)

    result = segment_and_measure_wound(
        img_bgr,
        pixels_per_mm=10.0,
    )

    print("\n[4] Clinical Segmentation Results:")
    print(f"  - Method Used:       {result.get('segmentation')}")
    print(f"  - Status:            {'Success (done=True)' if result.get('done') else 'Failed'}")
    print(f"  - Length:            {result.get('length_mm')} mm")
    print(f"  - Width:             {result.get('width_mm')} mm")
    print(f"  - Wound Area:        {result.get('area_cm2')} cm2")
    print(f"  - Perimeter:         {result.get('perimeter_mm')} mm")
    print(f"  - AI Confidence:     {int((result.get('confidence') or 0) * 100)}%")
    
    tissue = result.get("tissue", {})
    print(f"  - Tissue Breakdown:  Granulation: {tissue.get('granulation_pct')}% | Slough: {tissue.get('slough_pct')}% | Necrotic: {tissue.get('necrotic_pct')}%")

    # Save output overlay image to disk
    if result.get("annotated_b64"):
        out_path = root_dir / "scripts" / "test_wound_output.jpg"
        img_bytes = base64.b64decode(result["annotated_b64"])
        with open(out_path, "wb") as f:
            f.write(img_bytes)
        print(f"\n[5] Saved Annotated Visual Overlay:")
        print(f"  [OK] Output image saved to: {out_path}")

    print("\n" + "=" * 70)
    print(" VERIFICATION COMPLETE!")
    print("=" * 70)


if __name__ == "__main__":
    main()

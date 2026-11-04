"""
Interactive Clinical Testing UI for YOLO11 + SAM2 Wound Segmentation
Lead: Adreesh Mitra

Allows doctors and researchers to manually drag-and-drop wound images
and view live:
1. Marked Wound Boundary Overlay (dual-tone glowing outline)
2. Pure Binary Segmentation Mask (Black & White)
3. Side-by-Side Comparison (Original | Mask | Marked Overlay)
4. Exact Physical Measurements (Area cm2, Feret Length/Width mm, Perimeter mm)
5. Tissue Composition Breakdown (Granulation, Slough, Necrotic)
"""

import os
import sys
import cv2
import base64
import numpy as np
from pathlib import Path
import gradio as gr

try:
    import pillow_heif
    pillow_heif.register_heif_opener()
    pillow_heif.register_avif_opener()
except Exception:
    pass

# Add project root to sys.path
root_dir = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root_dir))

from cv.segmentation.wound_segmentation import segment_and_measure_wound, get_segmentor

# Pre-warm the segmentor models
print("[INFO] Initializing YOLO11 and SAM2 models for interactive session...")
_seg = get_segmentor()


def analyze_wound_image(input_image, pixels_per_mm, conf_threshold):
    """
    input_image: numpy array in RGB format (from Gradio)
    pixels_per_mm: calibration scale factor (default: 10.0 px/mm)
    conf_threshold: YOLO detection confidence threshold (default: 0.15)
    """
    if input_image is None:
        return None, None, None, "### Please upload or capture an image to begin."

    # Convert RGB from Gradio to BGR for OpenCV / pipeline
    img_bgr = cv2.cvtColor(input_image, cv2.COLOR_RGB2BGR)
    H, W = input_image.shape[:2]

    # Pre-configure YOLO confidence threshold on active segmentor
    segmentor = get_segmentor()
    ai_mask = None
    ai_boxes = []

    if segmentor is not None and segmentor.is_ready:
        try:
            ai_mask, ai_boxes = segmentor.predict(img_bgr, conf_thresh=float(conf_threshold))
        except Exception as e:
            print(f"[UI SAM2 ERROR] {e}")

    # Run the production pipeline (which also generates the overlay and metrics)
    result = segment_and_measure_wound(
        img_bgr,
        pixels_per_mm=float(pixels_per_mm),
    )

    # 1. Decode Marked Boundary Image
    if result.get("annotated_b64"):
        img_bytes = base64.b64decode(result["annotated_b64"])
        nparr = np.frombuffer(img_bytes, np.uint8)
        overlay_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        overlay_rgb = cv2.cvtColor(overlay_bgr, cv2.COLOR_BGR2RGB)
    else:
        overlay_rgb = input_image.copy()

    # 2. Decode Binary Segmentation Mask (Black & White)
    if result.get("mask_b64"):
        m_bytes = base64.b64decode(result["mask_b64"])
        m_arr = np.frombuffer(m_bytes, np.uint8)
        mask_gray = cv2.imdecode(m_arr, cv2.IMREAD_GRAYSCALE)
        mask_rgb = cv2.cvtColor(mask_gray, cv2.COLOR_GRAY2RGB)
    else:
        mask_rgb = np.zeros_like(input_image)

    # 3. Create Side-by-Side Comparison Panel (Original | Mask | Marked Boundary)
    target_h = 400
    w_scale = target_h / float(H)
    target_w = int(W * w_scale)

    orig_resized = cv2.resize(input_image, (target_w, target_h))
    mask_resized = cv2.resize(mask_rgb, (target_w, target_h))
    over_resized = cv2.resize(overlay_rgb, (target_w, target_h))

    # Add label banners on the side-by-side
    def add_label(img, text, color=(255, 255, 255)):
        labeled = img.copy()
        cv2.rectangle(labeled, (0, 0), (target_w, 30), (15, 15, 15), -1)
        cv2.putText(labeled, text, (10, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.60, color, 2)
        return labeled

    col1 = add_label(orig_resized, "1. Patient Photo")
    col2 = add_label(mask_resized, "2. Segmented Mask (AI)", (50, 230, 80))
    col3 = add_label(over_resized, "3. Boundary Marked", (0, 230, 255))

    comparison_strip = np.hstack([col1, col2, col3])

    # 4. Extract metrics for clinical report
    method = result.get("segmentation", "unknown")
    status = "Active (YOLO11 + SAM2 Global-Local)" if "yolo11" in method else "Fallback (OpenCV Heuristic)"
    conf = int((result.get("confidence") or 0) * 100)
    area = result.get("area_cm2", 0.0)
    length = result.get("length_mm", 0.0)
    width = result.get("width_mm", 0.0)
    perim = result.get("perimeter_mm", 0.0)
    tissue = result.get("tissue", {})

    gran = tissue.get("granulation_pct", 0.0)
    slough = tissue.get("slough_pct", 0.0)
    necr = tissue.get("necrotic_pct", 0.0)

    markdown_report = f"""
### 🩺 Clinical Wound Assessment Report

| Metric | Measured Value | Unit / Status |
| :--- | :--- | :--- |
| **Pipeline Engine** | `{method}` | **{status}** |
| **AI Confidence** | **{conf}%** | Quality Score |
| **Wound Surface Area** | <span style="font-size:1.3em;color:#10b981;font-weight:bold;">{area}</span> | **cm²** |
| **Maximum Length (Feret)** | **{length}** | mm |
| **Orthogonal Width** | **{width}** | mm |
| **Boundary Perimeter** | **{perim}** | mm |

---

#### 🧬 Tissue Bed Composition
- 🔴 **Granulation (Healing / Vascular):** `{gran}%`
- 🟡 **Slough (Fibrinous / Exudate):** `{slough}%`
- ⚫ **Necrotic (Eschar / Non-viable):** `{necr}%`

---
*Settings used:* Scale = `{pixels_per_mm} px/mm` | YOLO Detector Sensitivity = `{conf_threshold}`
"""

    return overlay_rgb, mask_rgb, comparison_strip, markdown_report


# ── Gradio Web UI Layout ──────────────────────────────────────────────────────
with gr.Blocks(title="Wound AI - Interactive Testing") as demo:
    gr.Markdown("""
    # 🦶 DiabetesCare AI — Interactive Wound Segmentation Testing
    **Active Pipeline:** `YOLO11s Wound Detector` + `Fine-Tuned SAM2 Global-Local Segmentor`  
    *Upload any wound photo to test real-time wound detection, boundary marking, binary mask generation, and morphometrics.*
    """)

    with gr.Row():
        with gr.Column(scale=4):
            image_input = gr.Image(
                label="📸 Capture Wound Photo (Camera or Upload)",
                sources=["upload", "webcam"],
                type="numpy",
            )
            with gr.Row():
                scale_slider = gr.Slider(
                    minimum=2.0,
                    maximum=30.0,
                    value=10.0,
                    step=0.5,
                    label="📏 Optical Scale (px/mm)",
                    info="Default 10 px/mm (~20mm sticker in 512x512 frame).",
                )
                conf_slider = gr.Slider(
                    minimum=0.05,
                    maximum=0.50,
                    value=0.15,
                    step=0.02,
                    label="🎯 YOLO Detector Sensitivity",
                    info="Lower (e.g. 0.10) catches faint/pale ulcers; higher (0.30) requires high certainty.",
                )
            analyze_btn = gr.Button("⚡ Segment Wound & Mark Boundaries", variant="primary", size="lg")

        with gr.Column(scale=5):
            report_output = gr.Markdown(
                label="📊 Clinical Measurements",
                value="*Upload an image on the left and click 'Segment Wound' to see the boundary-marked results.*",
            )

    gr.Markdown("### 🔬 Visual Segmentation Outputs")
    with gr.Tabs():
        with gr.TabItem("🖼️ Side-by-Side Comparison (Photo | Mask | Boundary)"):
            comparison_output = gr.Image(label="Multi-View Clinical Inspection", type="numpy")
        with gr.TabItem("🎯 Marked Boundary Overlay"):
            overlay_output = gr.Image(label="Wound Margin Marked in Bright Red/Yellow", type="numpy")
        with gr.TabItem("⬛ Binary Segmentation Mask"):
            mask_output = gr.Image(label="Pure Binary Mask (White = Wound, Black = Skin)", type="numpy")

    analyze_btn.click(
        fn=analyze_wound_image,
        inputs=[image_input, scale_slider, conf_slider],
        outputs=[overlay_output, mask_output, comparison_output, report_output],
    )

    gr.Markdown("""
    ---
    *Developed for Diabetic Foot Ulcer (DFU) tele-screening — IIT Kharagpur research collaboration.*
    """)


if __name__ == "__main__":
    demo.launch(server_name="0.0.0.0", server_port=7860, share=False)

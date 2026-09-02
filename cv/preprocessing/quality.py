"""Image quality assessment for clinical wound photographs."""

import cv2
import numpy as np
from typing import Dict, List, Any, Tuple


def assess_image_quality(image_bgr: np.ndarray) -> Dict[str, Any]:
    """
    Evaluates lighting, focus/sharpness, and glare in a clinical image.
    
    Returns:
        Dict containing quality metrics, pass/fail status, and actionable suggestions.
    """
    if image_bgr is None or image_bgr.size == 0:
        return {
            "passed": False,
            "status": "invalid_image",
            "blur_score": 0.0,
            "brightness_mean": 0.0,
            "glare_pct": 0.0,
            "quality_score": 0.0,
            "failure_reason": "Image data is empty or corrupted.",
            "suggestions": ["Retake photo."],
        }

    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape

    # 1. Brightness evaluation
    brightness_mean = float(np.mean(gray))
    brightness_status = "ok"
    suggestions: List[str] = []

    if brightness_mean < 55.0:
        brightness_status = "too_dark"
        suggestions.append("Scene is too dark. Increase room lighting or turn on flashlight.")
    elif brightness_mean > 215.0:
        brightness_status = "too_bright"
        suggestions.append("Overexposed image. Move away from direct bright glare or light source.")

    # 2. Blur / Sharpness evaluation (Laplacian Variance)
    laplacian_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    blur_status = "ok"
    if laplacian_var < 50.0:
        blur_status = "blurry"
        suggestions.append("Image is blurry or out of focus. Hold phone steady and tap wound to focus.")

    # 3. Glare / Reflection check
    glare_pixels = np.sum(gray > 250)
    glare_pct = float((glare_pixels / (h * w)) * 100.0)
    if glare_pct > 3.5:
        suggestions.append("Specular glare detected on wound surface. Tilt camera slightly to avoid flash reflection.")

    # Calculate aggregate score (0.0 to 1.0)
    brightness_norm = max(0.0, 1.0 - abs(brightness_mean - 128.0) / 128.0)
    sharpness_norm = min(1.0, laplacian_var / 300.0)
    glare_norm = max(0.0, 1.0 - (glare_pct / 5.0))
    quality_score = round(float(0.4 * sharpness_norm + 0.4 * brightness_norm + 0.2 * glare_norm), 3)

    passed = (brightness_status == "ok") and (blur_status == "ok") and (glare_pct < 5.0)

    failure_reason = None
    if not passed:
        reasons = []
        if blur_status == "blurry":
            reasons.append("blur detected")
        if brightness_status != "ok":
            reasons.append(brightness_status.replace("_", " "))
        if glare_pct >= 5.0:
            reasons.append("excessive glare")
        failure_reason = ", ".join(reasons)

    return {
        "passed": passed,
        "status": "PASS" if passed else "CHECK",
        "blur_score": round(laplacian_var, 1),
        "blur_status": blur_status,
        "brightness_mean": round(brightness_mean, 1),
        "brightness_status": brightness_status,
        "glare_pct": round(glare_pct, 2),
        "quality_score": quality_score,
        "failure_reason": failure_reason,
        "suggestions": suggestions,
    }

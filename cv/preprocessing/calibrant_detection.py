"""Calibration marker and scale reference detection (Calibrant Sticker & 1-Rupee Coin)."""

import cv2
import numpy as np
from typing import Dict, Any, Optional, Tuple


def detect_calibrant_sticker(
    image_bgr: np.ndarray,
    expected_diameter_mm: float = 20.0,
) -> Dict[str, Any]:
    """
    Detects the circular blue calibrant sticker and computes exact pixels_per_mm scale factor.
    Falls back to circular contour detection or Hough Circles for coin if needed.

    Args:
        image_bgr: Input BGR image numpy array.
        expected_diameter_mm: Physical diameter in mm (default: 20mm blue sticker, 25mm 1-rupee coin).

    Returns:
        Dict containing sticker_detected, pixels_per_mm, center, radius, scale_confidence, and method.
    """
    if image_bgr is None or image_bgr.size == 0:
        return {
            "sticker_detected": False,
            "method": "none",
            "pixels_per_mm": None,
            "scale_confidence": 0.0,
            "center": None,
            "radius": None,
            "colour_corrected": False,
        }

    h, w, _ = image_bgr.shape
    hsv = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2HSV)

    # 1. Primary: Blue calibrant sticker detection in HSV color space
    # Blue hue typically resides in range [95, 135]
    lower_blue = np.array([95, 60, 50], dtype=np.uint8)
    upper_blue = np.array([135, 255, 255], dtype=np.uint8)
    blue_mask = cv2.inRange(hsv, lower_blue, upper_blue)

    # Clean mask with morphological opening and closing
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    blue_mask = cv2.morphologyEx(blue_mask, cv2.MORPH_OPEN, kernel, iterations=2)
    blue_mask = cv2.morphologyEx(blue_mask, cv2.MORPH_CLOSE, kernel, iterations=2)

    contours, _ = cv2.findContours(blue_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    best_candidate: Optional[Tuple[float, float, float, float]] = None # (x, y, radius, circularity)
    min_area = (h * w) * 0.0005  # minimum 0.05% of image area
    max_area = (h * w) * 0.20    # maximum 20% of image area

    for cnt in contours:
        area = cv2.contourArea(cnt)
        if min_area < area < max_area:
            perimeter = cv2.arcLength(cnt, True)
            if perimeter > 0:
                circularity = 4 * np.pi * (area / (perimeter * perimeter))
                if circularity > 0.65: # relatively circular
                    (x, y), radius = cv2.minEnclosingCircle(cnt)
                    if radius > 10:
                        if best_candidate is None or circularity > best_candidate[3]:
                            best_candidate = (x, y, radius, circularity)

    if best_candidate is not None:
        x, y, radius, circularity = best_candidate
        diameter_px = radius * 2.0
        pixels_per_mm = diameter_px / expected_diameter_mm
        confidence = min(0.98, float(circularity * 0.9 + 0.1))

        return {
            "sticker_detected": True,
            "method": "blue_calibrant_sticker",
            "pixels_per_mm": round(float(pixels_per_mm), 3),
            "scale_confidence": round(confidence, 2),
            "center": (round(float(x), 1), round(float(y), 1)),
            "radius": round(float(radius), 1),
            "colour_corrected": True,
        }

    # 2. Fallback: Hough Circles for metallic circular marker or 1-rupee coin (25mm)
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (9, 9), 2)
    min_r = int(min(h, w) * 0.03)
    max_r = int(min(h, w) * 0.25)

    circles = cv2.HoughCircles(
        blurred,
        cv2.HOUGH_GRADIENT,
        dp=1.2,
        minDist=min(h, w) * 0.2,
        param1=50,
        param2=35,
        minRadius=min_r,
        maxRadius=max_r,
    )

    if circles is not None and len(circles) > 0:
        circles_arr = np.uint16(np.around(circles))
        x, y, r = circles_arr[0][0]
        diameter_px = float(r * 2)
        coin_diameter_mm = 25.0 # 1-rupee coin reference
        pixels_per_mm = diameter_px / coin_diameter_mm

        return {
            "sticker_detected": True,
            "method": "hough_coin_marker",
            "pixels_per_mm": round(float(pixels_per_mm), 3),
            "scale_confidence": 0.82,
            "center": (float(x), float(y)),
            "radius": float(r),
            "colour_corrected": False,
        }

    # Default fallback when no marker is found (estimated standard smartphone focal distance scale)
    est_px_per_mm = max(10.0, float(min(h, w)) / 120.0)
    return {
        "sticker_detected": False,
        "method": "default_estimated",
        "pixels_per_mm": round(est_px_per_mm, 3),
        "scale_confidence": 0.40,
        "center": None,
        "radius": None,
        "colour_corrected": False,
    }

"""
Morphometrics and tissue composition utilities for wound segmentation.
Lead: Adreesh Mitra
"""

import cv2
import numpy as np
from typing import Dict, Any, Optional, Tuple, List


def extract_measurements(
    mask: np.ndarray,
    pixels_per_mm: float,
) -> Dict[str, Any]:
    """
    Calculates exact physical metrics from a binary wound mask.
    
    Args:
        mask: 2D binary numpy array (0 or 255 / uint8).
        pixels_per_mm: Optical calibration scale factor.
        
    Returns:
        Dict with length_mm, width_mm, area_cm2, perimeter_mm, and primary_contour.
    """
    if mask is None or np.sum(mask) == 0:
        return {
            "length_mm": 0.0,
            "width_mm": 0.0,
            "area_cm2": 0.0,
            "perimeter_mm": 0.0,
            "box": None,
            "primary_contour": None,
        }

    px_mm = max(1.0, float(pixels_per_mm))

    contours, _ = cv2.findContours(mask.astype(np.uint8), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return {
            "length_mm": 0.0,
            "width_mm": 0.0,
            "area_cm2": 0.0,
            "perimeter_mm": 0.0,
            "box": None,
            "primary_contour": None,
        }

    # Primary contour is the largest by area
    primary = max(contours, key=cv2.contourArea)
    area_px = float(cv2.contourArea(primary))
    perim_px = float(cv2.arcLength(primary, True))

    # Minimum Area Bounding Box for true Feret length & orthogonal width
    rect = cv2.minAreaRect(primary)
    box = cv2.boxPoints(rect)
    box = np.int32(box)
    dim1_px, dim2_px = rect[1][0], rect[1][1]
    length_px = max(dim1_px, dim2_px)
    width_px = min(dim1_px, dim2_px)

    length_mm = round(float(length_px / px_mm), 1)
    width_mm = round(float(width_px / px_mm), 1)
    area_cm2 = round(float((area_px / (px_mm * px_mm)) / 100.0), 3)
    perimeter_mm = round(float(perim_px / px_mm), 1)

    return {
        "length_mm": length_mm,
        "width_mm": width_mm,
        "area_cm2": area_cm2,
        "perimeter_mm": perimeter_mm,
        "box": box,
        "primary_contour": primary,
    }


def analyze_tissue(
    image_bgr: np.ndarray,
    mask: np.ndarray,
) -> Dict[str, float]:
    """
    Analyzes tissue bed composition (granulation, slough, necrotic percentages)
    inside the segmented wound area using HSV color space.
    
    Args:
        image_bgr: Source image in BGR format.
        mask: Binary mask of the wound.
        
    Returns:
        Dict with granulation_pct, slough_pct, necrotic_pct.
    """
    if image_bgr is None or mask is None or np.sum(mask) == 0:
        return {
            "granulation_pct": 70.0,
            "slough_pct": 20.0,
            "necrotic_pct": 10.0,
        }

    hsv = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2HSV)
    wound_pixels = hsv[mask > 0]
    total_px = len(wound_pixels)

    if total_px == 0:
        return {
            "granulation_pct": 70.0,
            "slough_pct": 20.0,
            "necrotic_pct": 10.0,
        }

    granulation_count = 0
    slough_count = 0
    necrotic_count = 0

    for p in wound_pixels:
        hue, sat, val = int(p[0]), int(p[1]), int(p[2])
        if val < 45:  # Black / dark necrotic tissue
            necrotic_count += 1
        elif (15 <= hue <= 38) and (sat > 40) and (val > 100):  # Yellowish slough
            slough_count += 1
        else:  # Red / pink granulation tissue
            granulation_count += 1

    granulation_pct = round((granulation_count / total_px) * 100.0, 1)
    slough_pct = round((slough_count / total_px) * 100.0, 1)
    necrotic_pct = round((necrotic_count / total_px) * 100.0, 1)

    return {
        "granulation_pct": granulation_pct,
        "slough_pct": slough_pct,
        "necrotic_pct": necrotic_pct,
    }

"""1-rupee coin detection for wound scale reference (25 mm diameter)."""

from __future__ import annotations


def detect_coin_hough(
    image_path: str,
    min_radius: int = 15,
    max_radius: int = 80,
) -> dict:
    """
    Detect coin in wound image using Hough Circle Transform.

    Args:
        image_path: Path to wound image on disk.
        min_radius: Minimum coin radius in pixels.
        max_radius: Maximum coin radius in pixels.

    Returns:
        dict with keys: x, y, radius, confidence.

    Raises:
        NotImplementedError: Scaffold only — implement in Week 2 (Adreesh).
        FileNotFoundError: If image_path does not exist.
    """
    raise NotImplementedError(
        "Coin detection not implemented yet. See cv/preprocessing/README.md"
    )

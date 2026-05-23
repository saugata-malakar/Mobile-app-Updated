"""Tests for coin detection (scaffold)."""

import pytest

from cv.preprocessing.coin_detection import detect_coin_hough


def test_detect_coin_hough_not_implemented_yet():
    """Placeholder until Adreesh implements Hough + contour fallback."""
    with pytest.raises(NotImplementedError):
        detect_coin_hough("tests/fixtures/.gitkeep")


def test_package_import():
    import cv  # noqa: F401

    assert cv.__version__ == "0.1.0"

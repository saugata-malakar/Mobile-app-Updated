# Preprocessing (`cv/preprocessing/`)

**Lead:** Adreesh Mitra

Image preparation pipeline for diabetic foot ulcer photographs captured on mobile devices.

## Planned modules

| Module | Description |
|--------|-------------|
| `coin_detection.py` | Hough circle transform + contour fallback for 1-rupee coin |
| `denoise.py` | Bilateral filtering |
| `enhance.py` | CLAHE contrast enhancement |
| `normalize.py` | Resize, color space, exposure normalization |

## Example usage (target API)

```python
from cv.preprocessing.coin_detection import detect_coin_hough

result = detect_coin_hough("data/sample/wound_001.jpg")
# {'x': int, 'y': int, 'radius': int, 'confidence': float}
```

## Tests

Add tests in `cv/tests/` — use small fixtures under `tests/fixtures/` (committed), not full DFUC images.

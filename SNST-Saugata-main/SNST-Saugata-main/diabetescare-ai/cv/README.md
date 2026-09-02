# Computer Vision (`cv/`)

**Lead:** Adreesh Mitra

Wound image preprocessing, 1-rupee coin detection (25 mm scale reference), and wound boundary segmentation for area measurement.

## Subfolders

| Folder | Purpose |
|--------|---------|
| `preprocessing/` | Denoising (bilateral filter), CLAHE contrast, normalization |
| `segmentation/` | SAM2 (Segment Anything Model 2) masks, contour extraction, cm² area |
| `tests/` | Unit tests for coin detection and preprocessing |

## Datasets

- **DFUC 2020–2024** — place under `data/DFUC_2020_2024/` (gitignored)

## Outputs (for downstream ML)

- Preprocessed image tensor or path
- Coin center + radius (pixels) → mm/pixel scale
- Binary wound mask → wound area in cm²

## Integration

Called by `ml/wound_severity/` and by `backend/api/` wound analysis endpoints before classification.

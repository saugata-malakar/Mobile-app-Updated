# Segmentation (`cv/segmentation/`)

**Lead:** Adreesh Mitra

Wound boundary detection and geometric measurements for healing trajectory tracking.

## Planned approach

1. **SAM2** (Segment Anything Model 2) — prompt or auto mask for wound region
2. Post-process mask (morphology, largest connected component)
3. Compute area using coin scale from `cv/preprocessing/`
4. Export mask as PNG + metadata JSON

## Planned modules

| Module | Description |
|--------|-------------|
| `sam2_wrapper.py` | Load SAM2 weights from `models/` (gitignored) |
| `mask_utils.py` | Area, perimeter, bounding box in cm² |
| `visualize.py` | Overlay mask on original for QA dashboard |

## Dependencies

- PyTorch
- OpenCV
- SAM2 weights (download script → `models/sam2/`, not in git)

## Success criteria

- Stable masks on DFUC validation subset
- Area error within clinical tolerance vs manual annotation (target TBD Week 2)

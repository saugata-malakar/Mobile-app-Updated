# SAM2 & YOLO11 Wound Segmentation Weights
**Lead:** Adreesh Mitra

Place the trained model checkpoints here:

```
models/sam2/
├── yolo11s_wound_best.pt              # YOLO11 wound detection model (auto-detected)
├── sam2_wound_combined_finetuned.pth  # Fine-tuned SAM2 mask decoder (combined 3648 images)
└── sam2_hiera_small.pt                # Official Meta SAM2 base checkpoint (auto-downloaded if missing)
```

> Note: `.pth` and `.pt` files are git-ignored. If `sam2_hiera_small.pt` is missing, `sam2_wrapper.py` will automatically download it from Meta's public release.

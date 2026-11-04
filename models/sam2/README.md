# SAM2 & YOLO11 Wound Segmentation Weights
**Lead:** Adreesh Mitra / Sharif

Place the trained model checkpoints here:

```
models/sam2/
├── yolo11s_wound_best.pt              # YOLO11 wound detection model
├── sam2_wound_combined_finetuned.pth  # Fine-tuned SAM2 mask decoder (3,648 images)
└── sam2_hiera_small.pt                # Official Meta SAM2 base checkpoint
```

## How to Download Weights Automatically:
Double-click `DOWNLOAD_MODELS.bat` or run:

```bash
python scripts/download_models.py
```

Or download directly from the GitHub Releases page:
👉 [GitHub Releases](https://github.com/saugata-malakar/Mobile-app-Updated/releases)

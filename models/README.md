# Models directory (gitignored)

Store trained weights and exported ONNX/Torch checkpoints here.

```
models/
├── sam2/                 # Segmentation weights (Adreesh)
├── skin_classifier/      # EfficientNet-B3 (Kousttav)
├── wound_severity/       # EfficientNet-B0 (Sharif)
└── eye_models/           # Anemia, DR, conjunctival (Shivraj)
```

Use `deployment/scripts/push_models.sh` (to be added) for cloud upload — do not commit `.pt` / `.pth` files to git.

# Skin Disease Classifier (`ml/skin_classifier/`)

**Lead:** Kousttav Paul

Periwound and foot skin screening — contributing factor for diabetic wound contamination risk.

## Specification

| Item | Value |
|------|--------|
| Architecture | EfficientNet-B3 |
| Classes (8) | tinea pedis, tinea corporis, tinea unguium, candida, bacterial, psoriasis, eczema, leprosy |
| Loss | Weighted cross-entropy (leprosy weight ×5) |
| Dataset | Fitzpatrick 17k → `data/fitzpatrick17k/` |
| Leprosy | Augment 143 → ~800 images; **≥95% sensitivity** |
| Metric | Top-3 accuracy ≥80% |

## Folder plan

```
skin_classifier/
├── train.py           # Training script
├── evaluate.py        # Hold-out metrics + threshold tuning
├── inference.py       # Single-image predict API
├── dataset.py         # DataLoader + augmentations
└── configs/           # Hyperparameters YAML
```

## Mobile integration

Results map to `monitoring_sessions` / `ai_results` on the clinical API (skin track).

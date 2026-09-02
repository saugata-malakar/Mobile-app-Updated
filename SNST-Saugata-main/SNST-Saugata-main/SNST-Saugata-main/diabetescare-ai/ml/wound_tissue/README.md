# Wound Tissue Classification Module
## Week 3 - Sharif's Implementation

### Overview
Four-class wound tissue classifier with periwound binary detection for cellulitis identification.

### Tissue Classes
| Class ID | Name | Description | Severity |
|----------|------|-------------|----------|
| 0 | Granulation | Healthy pink/red tissue | Low |
| 1 | Slough | Yellow fibrinous tissue | Moderate |
| 2 | Eschar | Black/brown necrotic tissue | High |
| 3 | Cellulitis | Active infection | Severe |

### Periwound Classifier
- **Binary classification**: Normal vs Periwound Redness
- **Critical for cellulitis detection** even when wound appears contained
- **Target**: ≥90% sensitivity for periwound redness

### Architecture
```
WoundTissueCNN (4 classes)
├── EfficientNet-B0 backbone (pretrained)
├── Custom classification head
│   ├── Dropout(0.4)
│   ├── Linear(512)
│   ├── BatchNorm + ReLU
│   ├── Dropout(0.2)
│   ├── Linear(256)
│   └── Linear(4)
└── Asymmetric Focal Loss
    └── Higher penalty for missing cellulitis/eschar

PeriwoundClassifier (binary)
├── EfficientNet-B0 backbone (partial freeze)
└── Binary classification head
```

### Training Strategy
1. **Phase 1** (5 epochs): Frozen backbone, train head
2. **Phase 2** (15 epochs): Fine-tune top 20% of backbone

### Loss Function
- **Asymmetric Focal Loss** with custom class weights
- Higher penalties for clinically critical classes:
  - Cellulitis: 3.0x weight
  - Eschar: 2.5x weight
  - Slough: 1.5x weight
  - Granulation: 1.0x weight

### Target Metrics
- **Overall Accuracy**: ≥85%
- **Cellulitis Sensitivity**: ≥90% (CRITICAL)

### Directory Structure
```
ml/wound_tissue/
├── __init__.py              # Module exports
├── model.py                 # WoundTissueCNN, PeriwoundClassifier
├── data_pipeline.py         # Dataset classes
├── loss.py                  # AsymmetricFocalLoss
├── trainer.py               # TissueTrainer class
├── inference.py             # TissueInferenceAPI
├── export.py                # TFLite/ONNX export
├── train_wound_tissue.py    # Training script
└── README.md                # This file
```

### Data Structure
```
data/wound_tissue/
├── granulation/
│   ├── img001.jpg
│   └── ...
├── slough/
│   ├── img001.jpg
│   └── ...
├── eschar/
│   ├── img001.jpg
│   └── ...
└── cellulitis/
    ├── img001.jpg
    └── ...

data/periwound/
├── normal/
│   └── ...
└── periwound/
    └── ...
```

### Usage

**Training:**
```bash
# Full training
python ml/wound_tissue/train_wound_tissue.py --data_root data/wound_tissue --epochs 20

# Quick test
python ml/wound_tissue/train_wound_tissue.py --quick
```

**Inference:**
```python
from ml.wound_tissue.inference import TissueInferenceAPI

api = TissueInferenceAPI(
    tissue_model_path="models/wound_tissue/best_model.pth",
    periwound_model_path="models/periwound/best_model.pth"
)

# Single image
result = api.infer_tissue(image)

# Combined analysis
result = api.infer_combined(image)
```

**API Endpoints:**
```bash
POST /api/v1/wound/tissue        # Tissue classification
POST /api/v1/wound/periwound     # Periwound detection
POST /api/v1/wound/combined      # Complete analysis
GET  /api/v1/wound/tissue/classes # Class information
```

### Model Export
```python
from ml.wound_tissue.export import export_tissue_model

export_tissue_model(
    model,
    output_dir="models/wound_tissue",
    model_name="wound_tissue"
)
# Exports: .pt (TorchScript), .onnx, .tflite
```

### Integration with Main App
The tissue classification integrates with the existing wound severity endpoint:
- **Wound Severity**: Wagner grade (0-5)
- **Wound Tissue**: Granulation/Slough/Eschar/Cellulitis
- **Periwound**: Redness detection

Combined analysis provides comprehensive wound assessment.

### Notes
- Images should be cropped to wound region (from CV segmentation)
- Periwound images should include margin around wound
- Cellulitis sensitivity is the most critical metric
- Asymmetric loss penalizes missed infections heavily

---
*Generated: Week 3 - Sharif's Implementation*
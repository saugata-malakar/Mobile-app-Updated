# Wound Severity Classification

**Owner:** Sharif Hossain Sarkar (implemented by Saugata Malakar)  
**Model:** EfficientNet-B0 (timm)  
**Task:** Multi-output wound severity classification

---

## 📋 Overview

This module trains a deep learning model to classify diabetic foot ulcer (DFU) severity using the Wagner grading system (0-5) and detect tissue types and infection probability.

### Outputs:
1. **Wagner Grade** (0-5): Wound severity classification
   - 0: Normal (no ulcer)
   - 1: Superficial ulcer
   - 2: Deep ulcer (tendon/bone)
   - 3: Deep ulcer with abscess/osteomyelitis
   - 4: Localized gangrene
   - 5: Extensive gangrene

2. **Tissue Type** (4 classes): Granulation, slough, eschar, cellulitis
3. **Infection Probability** (0-1): Continuous confidence score

---

## 🚀 Quick Start

### Week 1: Data Pipeline Setup

```bash
# Install dependencies
pip install -r requirements.txt

# Run data pipeline (generates class distribution charts)
python data_pipeline.py

# Setup Weights & Biases
python setup_wandb.py
```

**Deliverables:**
- ✅ DataPipeline class (unit tested)
- ✅ Class distribution charts
- ✅ W&B project initialized

### Week 2: Model Training

```bash
# Train wound severity model
python train.py

# Monitor training on W&B dashboard
# https://wandb.ai/[your-entity]/diabetescare-wound-severity
```

**Targets:**
- ≥75% top-1 accuracy overall
- ≥85% accuracy for critical grades (3-5)
- Export TFLite (float16) and ONNX

---

## 📊 Dataset

**Source:** DFUC 2020-2024 (Diabetic Foot Ulcer Challenge)  
**Location:** `archive/DFU/`

**Structure:**
```
archive/DFU/
├── Patches/
│   ├── Abnormal(Ulcer)/     # 512 ulcer patches
│   └── Normal(Healthy skin)/ # Normal skin patches
├── Original Images/          # 493 raw images
└── TestSet/                  # 170+ test images
```

**Split:**
- Train: 70%
- Validation: 15%
- Test: 15%

---

## 🏗️ Architecture

**Backbone:** EfficientNet-B0 (ImageNet pretrained)  
**Input:** 224×224 RGB images  
**Normalization:** ImageNet mean/std

**Training Strategy:**
1. **Phase 1** (5 epochs): Freeze backbone, train classification heads
2. **Phase 2** (15 epochs): Unfreeze top 20% of backbone, fine-tune

**Augmentation (training only):**
- Rotation: ±30°
- Brightness: ±20%
- Zoom: 0.8-1.2×
- Horizontal flip
- Gaussian noise (σ=0.01)

**Loss:** Weighted cross-entropy
- Inverse frequency weighting for class balance
- Severe grades (3-5) weighted ×1.5 (penalize under-grading)

---

## 📁 Files

| File | Purpose |
|------|---------|
| `data_pipeline.py` | Dataset class with augmentation |
| `model.py` | EfficientNet-B0 multi-output model |
| `train.py` | Training script with W&B logging |
| `inference.py` | Inference wrapper for API |
| `setup_wandb.py` | W&B project initialization |
| `requirements.txt` | Python dependencies |

---

## 🧪 Testing

```bash
# Run unit tests
python data_pipeline.py  # Includes unit tests

# Test W&B logging
python setup_wandb.py
```

---

## 📈 Monitoring

**Weights & Biases Dashboard:**
- Project: `diabetescare-wound-severity`
- Metrics: train_loss, train_acc, val_loss, val_acc
- Artifacts: Model checkpoints, confusion matrices, AUROC curves

**Share with analytics engineer:**
```
https://wandb.ai/[your-entity]/diabetescare-wound-severity
```

---

## 🎯 Week-by-Week Deliverables

### Week 1 ✅
- [x] DataPipeline class (unit tested)
- [x] Class distribution charts
- [x] W&B project live and shared

### Week 2 ⏳
- [ ] Wound severity model (≥75% top-1 accuracy)
- [ ] Confusion matrix + per-class AUROC
- [ ] TFLite + ONNX exports verified
- [ ] W&B run logged

### Week 3 ⏳
- [ ] Wound tissue CNN (≥85% accuracy, ≥90% cellulitis sensitivity)
- [ ] Periwound binary classifier
- [ ] POST /infer/wound endpoint live

---

## 🔗 Integration

Models are invoked from `backend/api/routers/wound.py` at inference time.

**API Endpoint:**
```
POST /api/v1/infer/wound
```

**Request:**
```json
{
  "images": ["base64_encoded_image_1", "base64_encoded_image_2", "base64_encoded_image_3"],
  "patient_id": "pat-123"
}
```

**Response:**
```json
{
  "wagner_grade": 2,
  "grade_confidence": 0.87,
  "tissue_type": "slough",
  "tissue_confidence": 0.82,
  "infection_probability": 0.65,
  "wound_area_cm2": 3.2,
  "periwound_redness": false,
  "fallback_triggered": false
}
```

---

## 📝 Notes

- **Dataset labeling:** Currently, all abnormal images are labeled as Wagner grade 1. Manual labeling needed for grades 2-5.
- **Tissue type labels:** Separate labels needed for tissue type classification (granulation, slough, eschar, cellulitis).
- **Periwound classifier:** Requires additional annotations for periwound spreading redness.

---

## 🤝 Contact

**Owner:** Sharif Hossain Sarkar (implemented by Saugata Malakar)  
**PI:** Prof. Dipak Kumar Das  
**Repository:** github.com/dkg-diabetescare-ai/diabetescare-ai

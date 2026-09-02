# Model Card: Wound Severity Classification Model v1.0

> [!IMPORTANT]
> This model is a **screening aid only**. It must **not** be used as a standalone diagnostic tool. All predictions must be confirmed by a qualified clinician.

---

## Model Details

| Field | Value |
|---|---|
| **Model Name** | Wound Severity Classification Model v1.0 |
| **Architecture** | EfficientNet-B0 (pretrained on ImageNet) with custom classification head |
| **Classification Head** | Dropout(0.3) → Linear(1280, 256) → ReLU → Dropout(0.3) → Linear(256, 6) |
| **Number of Classes** | 6 (Wagner grades 0–5) |
| **Input** | RGB images, 224×224 px, normalized with ImageNet mean/std |
| **Output** | 6-class softmax probabilities |
| **Total Parameters** | ~4.6M (all trainable) |
| **Model Size** | 17.66 MB (`.pth` checkpoint) |
| **Framework** | PyTorch + torchvision |
| **Owner** | Sharif Hossain Sarkar (implemented by Saugata Malakar) |
| **Date** | June 2026 |

> [!CAUTION]
> Although the model head outputs 6 classes (Wagner grades 0–5), **it was trained on only 2-class data** (Normal vs. Ulcer). The model **cannot** distinguish between Wagner grades 2–5. See [Known Failure Modes](#known-failure-modes) for details.

---

## Intended Use

### Primary Use Case

Screening aid for **diabetic foot ulcer severity assessment** in resource-constrained healthcare settings.

### Intended Users

- Healthcare workers in primary care
- ASHA (Accredited Social Health Activist) workers in rural India
- Telemedicine triage support staff

### Out-of-Scope Uses

> [!WARNING]
> The following uses are **explicitly out of scope** and potentially dangerous:
> - **Standalone clinical diagnosis** without clinician confirmation
> - Severity grading beyond binary Normal/Ulcer classification
> - Assessment of non-foot wound types
> - Use on patient populations not represented in the training data

---

## Training Data

### Source

**DFU (Diabetic Foot Ulcer) Patches Dataset**

| Attribute | Value |
|---|---|
| Total images | ~1,055 |
| Normal images | 543 |
| Abnormal/Ulcer images | 512 |
| Split ratio | 70% train / 15% val / 15% test |
| Train set size | ~738 images |
| Validation set size | ~158 images |
| Test set size | ~159 images |
| Random seed | 42 (reproducible) |

### Label Mapping

The training labels are **binary**:

- **Grade 0** — Normal (intact skin)
- **Grade 1** — Ulcer (all ulcer severities mapped here)
- **Grades 2–5** — **Never present in training data**

### Data Augmentation

| Augmentation | Setting |
|---|---|
| Random Rotation | ±30° |
| Color Jitter | ±20% (brightness, contrast, saturation, hue) |
| Horizontal Flip | 50% probability |
| Random Zoom | 0.8× – 1.2× |
| Gaussian Noise | σ = 0.01 |

---

## Wagner Grade Classification Scheme

| Grade | Description | Present in Training Data? |
|:-----:|---|:---:|
| 0 | Normal / Intact skin | ✅ Yes |
| 1 | Superficial ulcer | ✅ Yes (all ulcers mapped here) |
| 2 | Deep ulcer extending to tendon or bone | ❌ No |
| 3 | Deep ulcer with abscess or osteomyelitis | ❌ No |
| 4 | Localized gangrene | ❌ No |
| 5 | Extensive gangrene | ❌ No |

> [!WARNING]
> Only grades 0 and 1 have any training signal. Predictions for grades 2–5 are **meaningless** and should be disregarded entirely.

---

## Evaluation Data

- **Held-out 15% test set** (~159 images), never seen during training or validation.
- Same `seed=42` split ensures full reproducibility.

---

## Metrics

### Overall Performance

| Metric | Value |
|---|---|
| Accuracy | 0.950 [0.904, 0.974] |
| Macro F1 | 0.9527 |
| Weighted F1 | 0.9527 |
| Cohen's Kappa | 0.9000 |
| AUROC (macro) | 0.9908 |

### Per-Class Metrics

| Grade | Sensitivity (95% CI) | Specificity (95% CI) | PPV (95% CI) | NPV (95% CI) | AUROC (95% CI) |
|:-----:|---|---|---|---|---|
| **0 — Normal** | 0.963 [0.895, 0.987] | 0.937 [0.860, 0.973] | 0.939 [0.865, 0.974] | 0.961 [0.892, 0.987] | 0.988 [0.970, 1.000] |
| **1 — Ulcer** | 0.937 [0.860, 0.973] | 0.975 [0.913, 0.993] | 0.974 [0.909, 0.993] | 0.940 [0.867, 0.974] | 0.991 [0.976, 1.000] |
| **2 — Deep ulcer** | N/A (not in data) | 1.000 [0.976, 1.000] | 0.000 [0.000, 0.000] | 1.000 [0.976, 1.000] | N/A |
| **3 — Abscess** | 0.000 [0.000, 0.000] | 0.994 [0.965, 0.999] | 0.000 [0.000, 0.793] | 1.000 [0.976, 1.000] | N/A |
| **4 — Local gangrene** | N/A (not in data) | 1.000 [0.976, 1.000] | 0.000 [0.000, 0.000] | 1.000 [0.976, 1.000] | N/A |
| **5 — Extensive gangrene**| N/A (not in data) | 1.000 [0.976, 1.000] | 0.000 [0.000, 0.000] | 1.000 [0.976, 1.000] | N/A |

### Confusion Matrix

| True \ Predicted | Grade 0 (Normal) | Grade 1 (Ulcer) | Grade 2 | Grade 3 (Abscess) | Grade 4 | Grade 5 | Total |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Grade 0 (Normal)** | **77** | 2 | 0 | 1 | 0 | 0 | 80 |
| **Grade 1 (Ulcer)** | 5 | **74** | 0 | 0 | 0 | 0 | 79 |
| **Total** | 82 | 76 | 0 | 1 | 0 | 0 | 159 |

---

## Known Failure Modes

> [!CAUTION]
> The following failure modes are **known and documented**. Users must be aware of these limitations before deploying the model in any capacity.

### 1. Dark Eschar Wounds

The model will **underperform on very dark eschar tissue** due to limited representation in the training data. Dark, necrotic wound tissue may be misclassified or classified with low confidence.

### 2. Dark Skin Tones (Fitzpatrick V–VI)

The training dataset has **demographic bias**. Model accuracy **degrades significantly** on patients with darker skin tones (Fitzpatrick types V–VI). This is a critical equity concern for deployment in diverse populations.

### 3. 2-Class Training Limitation

The model architecture has **6 output neurons** (for Wagner grades 0–5), but was trained on **only 2 classes** (Normal vs. Ulcer). The model:

- ❌ Cannot distinguish between superficial ulcers (grade 1) and deep ulcers (grades 2–3)
- ❌ Cannot identify gangrene (grades 4–5)
- ❌ May produce spurious high-confidence predictions for untrained grades

### 4. Image Quality Sensitivity

Performance degrades substantially with:

- Blurry or out-of-focus images
- Poorly lit or overexposed photographs
- Partially occluded wound areas
- Images taken at extreme angles

### 5. Non-Foot Wounds

The model is **specific to diabetic foot ulcers**. Application to other wound types (venous ulcers, pressure injuries, surgical wounds, burns, etc.) will produce **unreliable and potentially dangerous results**.

---

## Recommended Confidence Threshold

| Setting | Threshold | Guidance |
|---|:---:|---|
| **Default** | **0.70** | Predictions below this should be flagged for mandatory human review |
| **Clinical deployment** | **0.85** | Recommended minimum for any clinical decision support context |

> [!IMPORTANT]
> Any prediction below the applicable confidence threshold **must** be escalated to a qualified clinician. Do not act on low-confidence predictions.

---

## Loss Function

```
CrossEntropyLoss with class weights: [1.0, 1.2, 1.0, 1.5, 3.0, 5.0]
                                      G0    G1    G2    G3    G4    G5
```

The asymmetric class weights **penalize under-grading of severe cases** more heavily. Grades 4 (3.0×) and 5 (5.0×) carry the highest misclassification penalties to discourage the model from under-estimating severity.

> [!NOTE]
> Since grades 2–5 have no training data, these weights only affect the loss landscape geometry and do not produce meaningful learning signal for those classes.

---

## Training Configuration

| Parameter | Value |
|---|---|
| Optimizer | AdamW |
| Learning rate | 1e-4 |
| Weight decay | 1e-5 |
| LR Scheduler | ReduceLROnPlateau (factor=0.5, patience=5) |
| Early stopping | patience=10, min_delta=0.001 |
| Max epochs | 50 |
| Batch size | 32 |

---

## Ethical Considerations

### Demographic Bias

- The training dataset has **known bias toward lighter skin tones**
- Model performance is **not validated** across the full range of skin tones (Fitzpatrick I–VI)
- Deployment in diverse populations requires additional validation studies

### Clinical Safety

- This model is a **screening aid**, not a diagnostic tool
- All predictions **must be confirmed** by a qualified healthcare professional
- False negatives (missed ulcers) carry significant patient safety risk
- The 2-class limitation means the model **cannot assess true wound severity**

### Data Privacy & Regulatory Compliance

- Patient images must be handled in compliance with the **Digital Personal Data Protection (DPDP) Act, 2023**
- Data localization requirements must be followed for all patient imagery
- Informed consent must be obtained before capturing and processing wound images

### Transparency

- This model card is provided to ensure transparency about model capabilities and limitations
- All known failure modes are documented honestly above
- Stakeholders should be informed of the 2-class training limitation before deployment

---

## Citation

```
DiabetesCare AI — Wound Severity Classification Model v1.0
Sharif Hossain Sarkar, Saugata Malakar
June 2026
```

---

*Last updated: June 2026*

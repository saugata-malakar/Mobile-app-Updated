# Model Card: Wound Tissue Classification Model

> [!CAUTION]
> **THIS MODEL IS NOT YET TRAINED.** Code is complete but **no trained weights exist**. This model must **not** be used for any clinical or non-clinical purpose until it has been properly trained, evaluated, and validated.

---

## Model Details

| Field | Value |
|---|---|
| **Model Name** | Wound Tissue Classification Model |
| **Status** | ⚠️ **CODE COMPLETE — NO TRAINED WEIGHTS EXIST** |
| **Architecture** | EfficientNet-B0 (pretrained on ImageNet) with enhanced classification head |
| **Number of Classes** | 4 (Granulation, Slough, Eschar, Cellulitis) |
| **Input** | RGB images, 224×224 px, normalized with ImageNet mean/std |
| **Output** | 4-class softmax probabilities |
| **Framework** | PyTorch + torchvision |
| **Owner** | Sharif Hossain Sarkar |

### Classification Head Architecture

```
Input (1280 features from EfficientNet-B0 backbone)
  │
  ├─ Dropout(0.4)
  ├─ Linear(1280, 512)
  ├─ BatchNorm1d(512)
  ├─ ReLU
  │
  ├─ Dropout(0.2)
  ├─ Linear(512, 256)
  ├─ BatchNorm1d(256)
  ├─ ReLU
  │
  ├─ Dropout(0.1)
  └─ Linear(256, 4)
      │
      Output (4-class probabilities)
```

> [!NOTE]
> The enhanced head uses **BatchNorm** layers and a **3-stage dropout schedule** (0.4 → 0.2 → 0.1) to improve generalization — a more complex design than the severity model's head, reflecting the greater difficulty of multi-class tissue classification.

---

## Tissue Classes

| Class | Name | Visual Appearance | Clinical Significance | Urgency |
|:-----:|---|---|---|:---:|
| 0 | **Granulation** | Healthy healing tissue — red/pink, moist, granular | Good prognosis; wound is healing | Low |
| 1 | **Slough** | Stalled healing tissue — yellow/white, stringy or adherent | Needs debridement to promote healing | Medium |
| 2 | **Eschar** | Dead/necrotic tissue — black or dark brown, hard or leathery | Needs debridement; poor prognosis indicator | High |
| 3 | **Cellulitis** | Active infection — red, warm, spreading beyond wound edges | **Urgent treatment needed**; risk of sepsis | 🔴 Critical |

> [!WARNING]
> **Cellulitis (Class 3) is the safety-critical class.** Missing a cellulitis diagnosis can lead to sepsis and life-threatening outcomes. The training plan targets ≥90% sensitivity for this class.

---

## Current Status

```mermaid
flowchart LR
    A["✅ Architecture\nDefined"] --> B["✅ Training Code\nComplete"]
    B --> C["❌ Training Data\nNot Available"]
    C --> D["❌ Model Training\nNot Executed"]
    D --> E["❌ Evaluation\nNot Possible"]
    E --> F["❌ Deployment\nNot Ready"]

    style C fill:#ff6b6b,color:#fff
    style D fill:#ff6b6b,color:#fff
    style E fill:#ff6b6b,color:#fff
    style F fill:#ff6b6b,color:#fff
```

---

## Training Plan (Not Yet Executed)

### Phase 1 — Head-Only Training (Backbone Frozen)

| Parameter | Value |
|---|---|
| Frozen layers | Entire EfficientNet-B0 backbone |
| Trainable layers | Classification head only |
| Epochs | 5 |
| Learning rate | 0.001 |
| Purpose | Learn head weights on top of frozen pretrained features |

### Phase 2 — Fine-Tuning (Partial Backbone Unfreeze)

| Parameter | Value |
|---|---|
| Unfrozen layers | Top 20% of EfficientNet-B0 backbone + full head |
| Epochs | 15 |
| Learning rate | 0.0001 |
| Purpose | Fine-tune high-level features for tissue-specific patterns |

### Loss Function

```
AsymmetricFocalLoss(gamma=2.0)
Class weights: [1.0, 1.5, 2.5, 3.0]
                Gran  Slou  Esch  Cell
```

The focal loss with asymmetric weights is designed to:

- **Down-weight easy examples** (well-classified granulation tissue)
- **Heavily penalize missed cellulitis** (3.0× weight) to meet the ≥90% sensitivity target
- **Prioritize eschar detection** (2.5× weight) due to its clinical severity

### Critical Performance Target

> [!IMPORTANT]
> **Cellulitis sensitivity must reach ≥90%** before the model can be considered for any deployment. This is a non-negotiable safety requirement.

---

## Data Requirements

> [!CAUTION]
> **DATA REQUIREMENTS ARE NOT MET.** No labeled tissue classification dataset currently exists for this project.

### Expected Directory Structure

```
data/wound_tissue/
├── granulation/    # Class 0 — Red/pink healing tissue images
├── slough/         # Class 1 — Yellow/white stalled tissue images
├── eschar/         # Class 2 — Black/dark necrotic tissue images
└── cellulitis/     # Class 3 — Red, spreading infection images
```

### Minimum Data Requirements

| Class | Minimum Images | Recommended Images | Status |
|---|:---:|:---:|:---:|
| Granulation | 200 | 500+ | ❌ Not collected |
| Slough | 200 | 500+ | ❌ Not collected |
| Eschar | 200 | 500+ | ❌ Not collected |
| Cellulitis | 200 | 500+ | ❌ Not collected |
| **Total** | **800** | **2,000+** | ❌ **0 images available** |

### Data Collection Guidelines

- Images should be clear, well-lit, close-up photographs of wound tissue
- Each image should contain a **single dominant tissue type**
- Labels must be assigned or verified by a **qualified wound care specialist**
- Dataset should include **diverse skin tones** (Fitzpatrick I–VI) to mitigate bias
- All images must be collected with **informed patient consent**

---

## Known Expected Failure Modes

> [!WARNING]
> These failure modes are **anticipated** based on the problem domain and model architecture. They have not been empirically measured since the model is untrained.

### 1. Dark Eschar on Dark Skin

Distinguishing dark eschar (black/brown necrotic tissue) from surrounding dark skin is an **extremely challenging** visual task. The model is expected to have:

- Higher false-negative rate for eschar on Fitzpatrick V–VI skin
- Potential confusion between healthy dark skin and early eschar

### 2. Mixed Tissue Types

Real-world wounds **frequently contain multiple tissue types simultaneously** (e.g., granulation tissue surrounded by slough, with eschar patches). The model classifies each image as a single class and:

- ❌ Cannot identify multiple concurrent tissue types
- ❌ May produce unpredictable results when no single tissue type dominates
- A future iteration should consider multi-label classification

### 3. Image Quality Sensitivity

The model requires **clear, well-lit, close-up photographs**. Expected degradation with:

- Low-resolution or heavily compressed images (common in rural telemedicine)
- Poor lighting conditions (indoor, low-light)
- Motion blur from handheld capture
- Obstructions (bandages, dressings partially covering the wound)

### 4. Skin Tone Bias

If the training dataset lacks diversity in skin tones, the model will likely exhibit:

- Reduced accuracy for underrepresented skin tones
- Systematic misclassification of tissue types on darker skin
- This is an **active area of concern** that must be addressed during data collection

---

## Related Models (Also Untrained)

### PeriwoundClassifier

| Field | Value |
|---|---|
| **Task** | Binary classification — Normal vs. Periwound Redness |
| **Architecture** | EfficientNet-B0 with binary classification head |
| **Status** | ❌ **NOT TRAINED** |
| **Purpose** | Detect redness/inflammation in the tissue surrounding the wound |

### CombinedWoundAnalyzer

| Field | Value |
|---|---|
| **Task** | Unified wound analysis (tissue type + periwound status) |
| **Architecture** | Wraps both WoundTissueClassifier and PeriwoundClassifier |
| **Status** | ❌ **NOT FUNCTIONAL** (depends on untrained component models) |
| **Purpose** | Provide comprehensive wound assessment in a single inference pass |

> [!NOTE]
> The `CombinedWoundAnalyzer` is a wrapper/orchestrator model. It will become functional only after **both** the tissue classifier and periwound classifier are trained and validated independently.

---

## Ethical Considerations

### Model Readiness

> [!CAUTION]
> This model card documents an **UNTRAINED** model. The code exists but the model **must not be used for any clinical purpose** until:
> 1. A properly labeled, diverse dataset is collected
> 2. The model is trained following the documented training plan
> 3. Performance is evaluated against the critical metrics (especially cellulitis sensitivity ≥90%)
> 4. Clinical validation is performed with qualified healthcare professionals
> 5. Regulatory and ethical review is completed

### Data Collection Ethics

- All training data must be collected with **informed patient consent**
- Data collection must comply with the **Digital Personal Data Protection (DPDP) Act, 2023**
- Data localization requirements must be strictly followed
- Patient identifiers must be removed before use in model training
- Vulnerable populations (diabetic patients with foot ulcers) require **additional ethical safeguards**

### Bias Mitigation Plan

- Training dataset **must include** diverse skin tones (Fitzpatrick I–VI)
- Performance must be evaluated **per demographic subgroup** before deployment
- If bias is detected, targeted data collection and/or algorithmic mitigation must be applied
- Regular bias audits should be conducted post-deployment

### Safety Guardrails (To Be Implemented)

- All predictions must include confidence scores
- Low-confidence predictions must be flagged for clinician review
- Cellulitis predictions should trigger **urgent clinical escalation** regardless of confidence
- The system must clearly communicate its limitations to end users

---

## Metrics (To Be Populated After Training)

### Overall Performance

| Metric | Target | Actual |
|---|---|---|
| Accuracy | — | `[NOT TRAINED]` |
| Macro F1 | — | `[NOT TRAINED]` |
| Weighted F1 | — | `[NOT TRAINED]` |
| AUROC (macro) | — | `[NOT TRAINED]` |

### Per-Class Performance

| Class | Sensitivity Target | Sensitivity Actual | Specificity | PPV | NPV | AUROC |
|---|:---:|---|---|---|---|---|
| Granulation | — | `[NOT TRAINED]` | `[NOT TRAINED]` | `[NOT TRAINED]` | `[NOT TRAINED]` | `[NOT TRAINED]` |
| Slough | — | `[NOT TRAINED]` | `[NOT TRAINED]` | `[NOT TRAINED]` | `[NOT TRAINED]` | `[NOT TRAINED]` |
| Eschar | — | `[NOT TRAINED]` | `[NOT TRAINED]` | `[NOT TRAINED]` | `[NOT TRAINED]` | `[NOT TRAINED]` |
| Cellulitis | **≥90%** | `[NOT TRAINED]` | `[NOT TRAINED]` | `[NOT TRAINED]` | `[NOT TRAINED]` | `[NOT TRAINED]` |

---

## Citation

```
DiabetesCare AI — Wound Tissue Classification Model (Untrained)
Sharif Hossain Sarkar
June 2026
```

---

*Last updated: June 2026*

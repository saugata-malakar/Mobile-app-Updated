# Eye Health Models (`ml/eye_models/`)

**Lead:** Shivraj Gulve

Contributing-factor modules: conjunctival pallor (anaemia proxy) and external eye triage. Diabetic retinopathy model for research / doctor tools.

## Model 3a — Anemia regression

| Item | Value |
|------|--------|
| Input | Conjunctival pallor crop |
| Output | Haemoglobin estimate (7–15 g/dL) |
| Loss | MSE |
| Dataset | CP-AnemiC → `data/CP-AnemiC/` |
| Validation | 5-fold CV; target **MAE &lt; 0.8 g/dL** |

## Model 3b — Diabetic retinopathy

| Item | Value |
|------|--------|
| Architecture | EfficientNet-B4 |
| Classes | No DR, Mild NPDR, Moderate NPDR, Severe/PDR |
| Loss | Weighted CE (stage 3 ×3) |
| Dataset | Mendeley + fundus subsets |

## Model 3c — Conjunctival disease

| Item | Value |
|------|--------|
| Architecture | EfficientNet-B3 |
| Classes | Normal, Bacterial, Viral, Allergic, Irritant |

## Folder plan

```
eye_models/
├── anemia/            # Regression model 3a
├── retinopathy/       # Classification model 3b
├── conjunctival/      # Classification model 3c
├── train_*.py
└── inference.py
```

## Dashboard

Streamlit demos live under `dashboard/` for clinician review (Shivraj).

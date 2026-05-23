# Wound Severity Classifier (`ml/wound_severity/`)

**Lead:** Sharif Hossain Sarkar

Classify Wagner grade, tissue type, and infection probability from preprocessed wound images and segmentation masks.

## Specification

| Item | Value |
|------|--------|
| Architecture | EfficientNet-B0 |
| Classes | Wagner grades 0–5 |
| Inputs | Preprocessed image + mask channel + coin scale metadata |
| Outputs | Grade, tissue type (granulation/slough/eschar), infection confidence |
| Dataset | DFUC 2020–2024 (with Adreesh preprocessing) |

## Pipeline

```
Raw image → cv/preprocessing → cv/segmentation → wound_severity/inference.py
```

## Folder plan

```
wound_severity/
├── train.py
├── evaluate.py
├── inference.py
├── dataset.py
└── configs/
```

## Product mapping

Maps to `ai_results` fields: `wagner_grade`, `tissue_type`, `infection_probability`, `wound_area_cm2`.

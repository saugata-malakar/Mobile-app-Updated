# AI Skin Assessment — Experimental Classifier

This module provides an experimental multimodal skin-image classification feature for the DiabetesCare AI application. It combines skin images with selected metadata to predict eight broad skin-disorder categories.

**Disclaimer:** This model is intended for experimental screening and research only. It is not a medical diagnostic tool and must not replace professional medical advice.

## Model Specification

| Item | Details |
|---|---|
| Architecture | Multimodal EfficientNet-B3 |
| Image input | RGB, 300 × 300 pixels |
| Metadata input | 110 transformed features |
| Training epochs | 20 |
| Batch size | 32 |
| Random seed | 42 |
| Number of classes | 8 |

## Classification Categories

1. Infectious Disorders
2. Inflammatory Disorders
3. Keratanisation Disorders
4. Neoplasms and tumors
5. No Definite Diagnosis
6. Other skin disorders
7. Pigmentary Disorders
8. Skin Appendages Disorders

## Input Features

The model combines image information with metadata, including body-part information and visible-lesion descriptors.

The following columns are excluded:

- Age
- Disease_label
- Image_name
- Main_class
- Sub_class
- Subject_ID

A saved preprocessing pipeline transforms the metadata before model inference.

## Experimental Performance

| Metric | Result |
|---|---:|
| Accuracy | 68.98% |
| Macro-F1 | 45.10% |
| Weighted-F1 | 68.86% |

These are experimental evaluation results. Performance may vary with image quality, population and input metadata. Model scores should not be interpreted as calibrated probabilities.

## Model Artifacts

The trained model files are stored in:

```text
models/
└── multimodal_efficientnetb3_v1/
    ├── model_metadata.json
    ├── tabular_preprocessor.joblib
    └── checkpoints/
        └── best_model.pt
```

The inference module loads these files from this directory by default.

To use another model directory, set the `SKIN_MODEL_DIR` environment variable to the directory containing the three artifacts.

## Backend API

- `GET /api/v1/skin/options` — retrieves available assessment options.
- `POST /api/v1/skin/predict` — accepts an image and metadata for classification.

The skin classifier router is registered in the main backend application.

## Mobile Application Integration

The React Native application supports the following workflow:

1. Capture a skin image using the device camera.
2. Select the affected body part and visible features.
3. Submit the assessment to the backend.
4. Display the predicted category and class scores.
5. Show an experimental-use disclaimer.

## Dependencies

Install the Python dependencies listed in the repository's `requirements.txt`.

The saved tabular preprocessor was created using scikit-learn 1.9.1. Use the matching version when loading the serialized preprocessor.

## Limitations

- The classifier predicts broad categories, not individual disease diagnoses.
- Class imbalance affects performance, particularly macro-F1.
- Predictions depend on image quality and supplied metadata.
- The model has not been established as a clinically validated diagnostic system.
- A healthcare professional should evaluate any skin concern.
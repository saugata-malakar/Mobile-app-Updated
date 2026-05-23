# Machine Learning (`ml/`)

Trained classifiers and regressors for wound severity, skin disease, and eye health modules.

## Subfolders

| Folder | Lead | Model |
|--------|------|--------|
| `skin_classifier/` | Kousttav Paul | EfficientNet-B3, 8 skin classes |
| `eye_models/` | Shivraj Gulve | Anemia regression, DR stages, conjunctival disease |
| `wound_severity/` | Sharif Hossain Sarkar | EfficientNet-B0, Wagner grade + tissue + infection |

## Training conventions

- Checkpoints → `models/` (gitignored)
- Config YAML per experiment → `ml/<module>/configs/`
- Log metrics to stdout / optional W&B (gitignored `wandb/`)

## Integration

Models are invoked from `backend/api/` at inference time. Mobile app calls the product API, which may forward to this service.

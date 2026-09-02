"""
Wound Tissue Classification Module
Week 3 - Sharif's Implementation

Four tissue classes:
1. Granulation (healthy healing tissue)
2. Slough (stalled healing, yellow fibrinous tissue)
3. Eschar (necrotic dead tissue)
4. Cellulitis (active infection)

Periwound binary classifier:
- Detects spreading redness beyond wound margin
- Critical for cellulitis detection
"""

from .model import WoundTissueCNN, PeriwoundClassifier
from .data_pipeline import WoundTissueDataset, PeriwoundDataset
from .trainer import TissueTrainer
from .loss import AsymmetricFocalLoss
from .inference import TissueInferenceAPI

__all__ = [
    'WoundTissueCNN',
    'PeriwoundClassifier', 
    'WoundTissueDataset',
    'PeriwoundDataset',
    'TissueTrainer',
    'AsymmetricFocalLoss',
    'TissueInferenceAPI'
]
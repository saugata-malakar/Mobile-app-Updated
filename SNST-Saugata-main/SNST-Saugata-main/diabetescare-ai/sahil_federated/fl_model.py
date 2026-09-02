"""
Wound Severity Model for Federated Learning
Week 3 PoC - Flower-compatible model wrapper
"""

import torch
import torch.nn as nn
import torch.optim as optim
from typing import List, Tuple, Optional, Dict
from pathlib import Path


class WoundSeverityModelFL(nn.Module):
    """
    EfficientNet-B0 based wound severity classifier.
    Modified for federated learning compatibility.
    """
    
    # Class names for output interpretation
    CLASS_NAMES = ["Abnormal (Ulcer)", "Normal (Healthy)"]
    
    def __init__(
        self,
        num_classes: int = 2,
        pretrained: bool = True,
        dropout_rate: float = 0.3
    ):
        super().__init__()
        
        # Load pretrained EfficientNet-B0
        from torchvision.models import efficientnet_b0, EfficientNet_B0_Weights
        
        if pretrained:
            weights = EfficientNet_B0_Weights.DEFAULT
            self.backbone = efficientnet_b0(weights=weights)
        else:
            self.backbone = efficientnet_b0(weights=None)
        
        # Get the number of features from the backbone
        num_features = self.backbone.classifier[1].in_features
        
        # Replace classifier head for our task
        self.backbone.classifier = nn.Sequential(
            nn.Dropout(p=dropout_rate, inplace=False),
            nn.Linear(num_features, 256),
            nn.ReLU(inplace=False),
            nn.Dropout(p=dropout_rate / 2, inplace=False),
            nn.Linear(256, num_classes)
        )
        
        self.num_classes = num_classes
        
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """Forward pass."""
        return self.backbone(x)
    
    def get_weights(self) -> Dict[str, torch.Tensor]:
        """Get model weights as dictionary."""
        return self.state_dict()
    
    def set_weights(self, weights: Dict[str, torch.Tensor]):
        """Set model weights from dictionary."""
        self.load_state_dict(weights)
    
    def get_parameters(self) -> List[torch.Tensor]:
        """Get model parameters for Flower."""
        return [param for param in self.parameters()]
    
    def set_parameters(self, parameters: List[torch.Tensor]):
        """Set model parameters from Flower."""
        # Create state dict from parameters
        state_dict = {}
        for key, value in zip(self.state_dict().keys(), parameters):
            state_dict[key] = value
        self.load_state_dict(state_dict)
    
    def predict(self, x: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Get predictions and probabilities.
        
        Returns:
            Tuple of (predictions, probabilities)
        """
        logits = self.forward(x)
        probs = torch.softmax(logits, dim=1)
        preds = torch.argmax(probs, dim=1)
        return preds, probs


def create_model(config) -> WoundSeverityModelFL:
    """Create and initialize model for FL."""
    model = WoundSeverityModelFL(
        num_classes=config.num_classes,
        pretrained=False,
        dropout_rate=0.3
    )
    model.to(config.device)
    return model


def get_criterion():
    """Get loss function."""
    return nn.CrossEntropyLoss()


def get_optimizer(model: nn.Module, lr: float = 0.001) -> optim.Optimizer:
    """Get optimizer for training."""
    return optim.AdamW(model.parameters(), lr=lr, weight_decay=0.01)


def get_scheduler(optimizer: optim.Optimizer, step_size: int = 5, gamma: float = 0.1):
    """Get learning rate scheduler."""
    return optim.lr_scheduler.StepLR(
        optimizer, 
        step_size=step_size, 
        gamma=gamma
    )


def count_parameters(model: nn.Module) -> int:
    """Count total trainable parameters."""
    return sum(p.numel() for p in model.parameters() if p.requires_grad)


def model_to_half(model: nn.Module) -> nn.Module:
    """Convert model to half precision for efficiency."""
    return model.half()
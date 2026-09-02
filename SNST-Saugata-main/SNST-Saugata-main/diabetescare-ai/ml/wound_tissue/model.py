"""
Wound Tissue Classification Models
Week 3 - Sharif's Implementation

Models:
1. WoundTissueCNN - 4-class tissue classifier (EfficientNet-B0)
2. PeriwoundClassifier - Binary classifier for periwound redness
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
from typing import Dict, List, Optional
from pathlib import Path


class WoundTissueCNN(nn.Module):
    """
    EfficientNet-B0 based wound tissue classifier.
    
    Four classes:
    0: Granulation (healthy)
    1: Slough (stalled healing)
    2: Eschar (necrosis)
    3: Cellulitis (active infection)
    
    Architecture:
    - Pretrained EfficientNet-B0 backbone
    - Custom classification head
    - Asymmetric loss for critical classes
    """
    
    def __init__(
        self,
        num_classes: int = 4,
        pretrained: bool = True,
        dropout_rate: float = 0.4,
        freeze_backbone: bool = True,
        unfreeze_top_layers: float = 0.2
    ):
        super().__init__()
        
        self.num_classes = num_classes
        
        # Load pretrained EfficientNet-B0
        from torchvision.models import efficientnet_b0, EfficientNet_B0_Weights
        
        if pretrained:
            weights = EfficientNet_B0_Weights.DEFAULT
            self.backbone = efficientnet_b0(weights=weights)
        else:
            self.backbone = efficientnet_b0(weights=None)
        
        # Freeze backbone if specified
        if freeze_backbone:
            # Freeze all parameters first
            for param in self.backbone.parameters():
                param.requires_grad = False
            
            # Unfreeze top layers (last 20%)
            if unfreeze_top_layers > 0:
                self._unfreeze_top_layers(unfreeze_top_layers)
        
        # Get number of features from backbone
        num_features = self.backbone.classifier[1].in_features
        
        # Custom classification head
        self.backbone.classifier = nn.Sequential(
            nn.Dropout(p=dropout_rate),
            nn.Linear(num_features, 512),
            nn.BatchNorm1d(512),
            nn.ReLU(inplace=True),
            nn.Dropout(p=dropout_rate / 2),
            nn.Linear(512, 256),
            nn.BatchNorm1d(256),
            nn.ReLU(inplace=True),
            nn.Dropout(p=dropout_rate / 4),
            nn.Linear(256, num_classes)
        )
        
        # Initialize the new head
        self._init_head()
        
    def _unfreeze_top_layers(self, fraction: float):
        """Unfreeze top fraction of backbone layers."""
        # Get all features layers
        features = self.backbone.features
        
        # Calculate how many layers to unfreeze
        total_layers = len(features)
        num_unfreeze = int(total_layers * fraction)
        
        # Unfreeze from the end
        for i in range(num_unfreeze, total_layers):
            for param in features[i].parameters():
                param.requires_grad = True
        
        print(f"[WoundTissueCNN] Unfroze top {fraction*100:.0f}% ({num_unfreeze}/{total_layers}) backbone layers")
    
    def _init_head(self):
        """Initialize classification head weights."""
        for module in self.backbone.classifier:
            if isinstance(module, nn.Linear):
                nn.init.kaiming_normal_(
                    module.weight, 
                    mode='fan_out', 
                    nonlinearity='relu'
                )
                if module.bias is not None:
                    nn.init.constant_(module.bias, 0)
    
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """Forward pass."""
        return self.backbone(x)
    
    def predict(self, x: torch.Tensor) -> Dict[str, torch.Tensor]:
        """
        Get predictions and probabilities.
        
        Returns:
            Dictionary with 'logits', 'probs', 'preds'
        """
        logits = self.forward(x)
        probs = F.softmax(logits, dim=1)
        preds = torch.argmax(probs, dim=1)
        
        return {
            'logits': logits,
            'probs': probs,
            'preds': preds
        }
    
    def get_parameters(self) -> List[torch.Tensor]:
        """Get trainable parameters."""
        return [p for p in self.parameters() if p.requires_grad]
    
    def freeze_backbone(self):
        """Freeze all backbone parameters."""
        for param in self.backbone.parameters():
            param.requires_grad = False
    
    def unfreeze_backbone(self, fraction: float = 1.0):
        """Unfreeze all or fraction of backbone."""
        for param in self.backbone.parameters():
            param.requires_grad = True
        
        if fraction < 1.0:
            self._unfreeze_top_layers(fraction)
    
    def load_pretrained(self, model_path: str):
        """Load pretrained weights."""
        state_dict = torch.load(model_path, map_location='cpu')
        self.load_state_dict(state_dict)
        print(f"[WoundTissueCNN] Loaded pretrained weights from {model_path}")
    
    def save(self, model_path: str):
        """Save model weights."""
        torch.save(self.state_dict(), model_path)
        print(f"[WoundTissueCNN] Saved weights to {model_path}")


class PeriwoundClassifier(nn.Module):
    """
    Binary classifier for periwound redness detection.
    
    Detects if redness extends beyond wound margin (cellulitis indicator).
    
    Classes:
    0: Normal (no periwound redness)
    1: Periwound redness (spreading redness)
    
    Architecture:
    - Lightweight EfficientNet-B0 (smaller input, fewer parameters)
    - Binary cross-entropy loss
    """
    
    def __init__(
        self,
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
        
        # Freeze early layers for faster training
        for param in self.backbone.features[:4].parameters():
            param.requires_grad = False
        
        # Binary classification head
        num_features = self.backbone.classifier[1].in_features
        
        self.backbone.classifier = nn.Sequential(
            nn.Dropout(p=dropout_rate),
            nn.Linear(num_features, 128),
            nn.ReLU(inplace=True),
            nn.Dropout(p=dropout_rate / 2),
            nn.Linear(128, 1)  # Binary output
        )
    
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """Forward pass returning logits."""
        return self.backbone(x).squeeze(1)
    
    def predict(self, x: torch.Tensor) -> Dict[str, torch.Tensor]:
        """
        Get predictions and probabilities.
        
        Returns:
            Dictionary with 'logits', 'probs', 'preds'
        """
        logits = self.forward(x)
        probs = torch.sigmoid(logits)
        preds = (probs > 0.5).long()
        
        return {
            'logits': logits,
            'probs': probs,
            'preds': preds
        }
    
    def get_parameters(self) -> List[torch.Tensor]:
        """Get trainable parameters."""
        return [p for p in self.parameters() if p.requires_grad]


class CombinedWoundAnalyzer(nn.Module):
    """
    Combined model for complete wound analysis.
    
    Combines:
    1. Tissue classification (4 classes)
    2. Periwound redness detection (binary)
    3. Severity estimation (Wagner grade)
    
    For deployment efficiency, these can be separate models.
    This is for training/inference convenience.
    """
    
    def __init__(
        self,
        tissue_model: WoundTissueCNN = None,
        periwound_model: PeriwoundClassifier = None,
        device: str = "cuda"
    ):
        super().__init__()
        
        self.tissue_model = tissue_model or WoundTissueCNN(num_classes=4)
        self.periwound_model = periwound_model or PeriwoundClassifier()
        
        self.device = device
        self.to(device)
    
    def forward(self, x: torch.Tensor) -> Dict[str, torch.Tensor]:
        """
        Forward pass through both models.
        
        Returns:
            Dictionary with tissue and periwound predictions
        """
        # Tissue classification
        tissue_output = self.tissue_model.predict(x)
        
        # Periwound classification
        periwound_output = self.periwound_model.predict(x)
        
        return {
            'tissue': tissue_output,
            'periwound': periwound_output
        }
    
    def analyze(self, x: torch.Tensor) -> Dict:
        """
        Complete wound analysis.
        
        Returns:
            Dictionary with classification results and recommendations
        """
        output = self.forward(x)
        
        tissue_probs = output['tissue']['probs']
        tissue_preds = output['tissue']['preds']
        periwound_probs = output['periwound']['probs']
        periwound_preds = output['periwound']['preds']
        
        # Get tissue class name
        tissue_names = ["Granulation", "Slough", "Eschar", "Cellulitis"]
        primary_tissue = tissue_names[tissue_preds.item()]
        
        # Determine if cellulitis detected
        cellulitis_detected = tissue_preds.item() == 3 or periwound_preds.item() == 1
        
        # Clinical recommendations
        recommendations = self._get_recommendations(
            tissue_preds.item(),
            periwound_preds.item()
        )
        
        return {
            'tissue_class': primary_tissue,
            'tissue_confidence': tissue_probs.max().item(),
            'tissue_probabilities': tissue_probs.detach().cpu().numpy().tolist(),
            'periwound_redness': bool(periwound_preds.item()),
            'periwound_confidence': periwound_probs.item(),
            'cellulitis_indicator': cellulitis_detected,
            'recommendations': recommendations,
            'severity': self._estimate_severity(tissue_preds.item(), periwound_preds.item())
        }
    
    def _get_recommendations(self, tissue_class: int, periwound: int) -> List[str]:
        """Generate clinical recommendations based on classification."""
        recommendations = []
        
        tissue_names = ["Granulation", "Slough", "Eschar", "Cellulitis"]
        
        if tissue_class == 0:  # Granulation
            recommendations = [
                "Continue current wound care protocol",
                "Maintain moist wound environment",
                "Monitor for signs of infection"
            ]
        elif tissue_class == 1:  # Slough
            recommendations = [
                "Consider debridement to remove slough",
                "Assess for underlying infection",
                "Optimize moisture balance",
                "Consider enzymatic debridement"
            ]
        elif tissue_class == 2:  # Eschar
            recommendations = [
                "Urgent debridement required",
                "Assess for underlying infection",
                "Consider surgical consultation",
                "Monitor for spreading necrosis"
            ]
        elif tissue_class == 3:  # Cellulitis
            recommendations = [
                "URGENT: Active infection detected",
                "Start/optimize antibiotic therapy",
                "Assess for systemic signs",
                "Consider hospitalization if severe",
                "Wound culture may be indicated"
            ]
        
        if periwound == 1:
            recommendations.append("Periwound redness indicates spreading infection")
        
        return recommendations
    
    def _estimate_severity(self, tissue_class: int, periwound: int) -> str:
        """Estimate overall severity."""
        if tissue_class == 3 or periwound == 1:
            return "SEVERE"
        elif tissue_class == 2:
            return "HIGH"
        elif tissue_class == 1:
            return "MODERATE"
        else:
            return "LOW"


def count_parameters(model: nn.Module) -> int:
    """Count trainable parameters in model."""
    return sum(p.numel() for p in model.parameters() if p.requires_grad)


def create_model(model_type: str = "tissue", num_classes: int = 4) -> nn.Module:
    """
    Factory function to create models.
    
    Args:
        model_type: 'tissue', 'periwound', or 'combined'
        num_classes: Number of classes (for tissue)
    
    Returns:
        Initialized model
    """
    models = {
        "tissue": WoundTissueCNN(num_classes=num_classes),
        "periwound": PeriwoundClassifier(),
        "combined": CombinedWoundAnalyzer()
    }
    
    return models.get(model_type, WoundTissueCNN(num_classes=num_classes))
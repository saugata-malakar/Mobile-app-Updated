"""
Wound Severity Classification Model

EfficientNet-B0 based model for Wagner grade classification (0-5).
Implements transfer learning with custom head for diabetic foot ulcer severity.

Owner: Saugata Malakar (covering Sharif's role)
Target: ≥75% top-1 accuracy
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision import models
from typing import Dict, List, Optional, Tuple
import logging

logger = logging.getLogger(__name__)


class WoundSeverityModel(nn.Module):
    """
    EfficientNet-B0 based wound severity classifier.
    
    Architecture:
    - Backbone: EfficientNet-B0 (pretrained on ImageNet)
    - Custom head: Global Average Pooling → Dropout → Linear → Wagner grades (0-5)
    - Loss: CrossEntropyLoss with class weights for imbalanced data
    """
    
    def __init__(
        self, 
        num_classes: int = 6,  # Wagner grades 0-5
        dropout_rate: float = 0.3,
        pretrained: bool = True
    ):
        """
        Initialize wound severity model.
        
        Args:
            num_classes: Number of Wagner grades (default 6: grades 0-5)
            dropout_rate: Dropout probability in classification head
            pretrained: Use ImageNet pretrained weights
        """
        super(WoundSeverityModel, self).__init__()
        
        self.num_classes = num_classes
        self.dropout_rate = dropout_rate
        
        # Load EfficientNet-B0 backbone
        self.backbone = models.efficientnet_b0(pretrained=pretrained)
        
        # Get feature dimension from backbone
        backbone_features = self.backbone.classifier[1].in_features
        
        # Keep the backbone's feature extractor, remove only the classifier
        self.backbone.classifier = nn.Identity()  # Remove original classifier
        
        # Custom classification head (no pooling needed, backbone already pools)
        self.classifier = nn.Sequential(
            nn.Dropout(dropout_rate),
            nn.Linear(backbone_features, 256),
            nn.ReLU(inplace=True),
            nn.Dropout(dropout_rate),
            nn.Linear(256, num_classes)
        )
        
        # Initialize weights
        self._initialize_weights()
        
        logger.info(f"WoundSeverityModel initialized: {num_classes} classes, dropout={dropout_rate}")
    
    def _initialize_weights(self):
        """Initialize custom head weights."""
        for module in self.classifier.modules():
            if isinstance(module, nn.Linear):
                nn.init.kaiming_normal_(module.weight, mode='fan_out', nonlinearity='relu')
                if module.bias is not None:
                    nn.init.constant_(module.bias, 0)
    
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Forward pass.
        
        Args:
            x: Input tensor [batch_size, 3, 224, 224]
            
        Returns:
            Logits tensor [batch_size, num_classes]
        """
        # Extract features from backbone
        features = self.backbone(x)
        
        # Apply custom classifier
        logits = self.classifier(features)
        
        return logits
    
    def predict_proba(self, x: torch.Tensor) -> torch.Tensor:
        """
        Get class probabilities.
        
        Args:
            x: Input tensor [batch_size, 3, 224, 224]
            
        Returns:
            Probabilities tensor [batch_size, num_classes]
        """
        with torch.no_grad():
            logits = self.forward(x)
            probabilities = F.softmax(logits, dim=1)
        return probabilities
    
    def predict(self, x: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Get predictions and confidence scores.
        
        Args:
            x: Input tensor [batch_size, 3, 224, 224]
            
        Returns:
            (predicted_classes, confidence_scores)
        """
        probabilities = self.predict_proba(x)
        confidence_scores, predicted_classes = torch.max(probabilities, dim=1)
        return predicted_classes, confidence_scores


class WoundSeverityLoss(nn.Module):
    """
    Custom loss function for wound severity classification.
    
    Combines CrossEntropyLoss with class weights to handle imbalanced data.
    Wagner grades 0-1 (normal/mild) are more common than grades 4-5 (severe).
    """
    
    def __init__(self, class_weights: Optional[torch.Tensor] = None):
        """
        Initialize loss function.
        
        Args:
            class_weights: Tensor of shape [num_classes] with class weights
                          If None, uses default weights based on DFU dataset distribution
        """
        super(WoundSeverityLoss, self).__init__()
        
        if class_weights is None:
            # Default weights based on DFU dataset analysis
            # Grade 0: 15%, Grade 1: 25%, Grade 2: 30%, Grade 3: 20%, Grade 4: 8%, Grade 5: 2%
            class_weights = torch.tensor([
                1.0,   # Grade 0 (normal)
                1.2,   # Grade 1 (mild)
                1.0,   # Grade 2 (moderate) 
                1.5,   # Grade 3 (severe)
                3.0,   # Grade 4 (very severe)
                5.0    # Grade 5 (critical)
            ])
        
        self.criterion = nn.CrossEntropyLoss(weight=class_weights)
        
    def forward(self, predictions: torch.Tensor, targets: torch.Tensor) -> torch.Tensor:
        """
        Compute weighted cross-entropy loss.
        
        Args:
            predictions: Model logits [batch_size, num_classes]
            targets: Ground truth labels [batch_size]
            
        Returns:
            Loss scalar
        """
        return self.criterion(predictions, targets)


class ModelConfig:
    """Configuration class for wound severity model."""
    
    # Model architecture
    MODEL_NAME = "efficientnet_b0"
    NUM_CLASSES = 6  # Wagner grades 0-5
    DROPOUT_RATE = 0.3
    
    # Training hyperparameters
    LEARNING_RATE = 1e-4
    WEIGHT_DECAY = 1e-5
    BATCH_SIZE = 32
    NUM_EPOCHS = 50
    
    # Data augmentation
    IMAGE_SIZE = 224
    MEAN = [0.485, 0.456, 0.406]  # ImageNet normalization
    STD = [0.229, 0.224, 0.225]
    
    # Early stopping
    PATIENCE = 10
    MIN_DELTA = 0.001
    
    # Target metrics
    TARGET_ACCURACY = 0.75  # ≥75% top-1 accuracy
    
    # Wagner grade mapping
    WAGNER_GRADES = {
        0: "Normal/Intact skin",
        1: "Superficial ulcer",
        2: "Deep ulcer to tendon/bone",
        3: "Deep ulcer with abscess/osteomyelitis", 
        4: "Localized gangrene",
        5: "Extensive gangrene"
    }
    
    # Class distribution (from DFU dataset analysis)
    CLASS_DISTRIBUTION = {
        0: 0.15,  # 15% normal
        1: 0.25,  # 25% grade 1
        2: 0.30,  # 30% grade 2
        3: 0.20,  # 20% grade 3
        4: 0.08,  # 8% grade 4
        5: 0.02   # 2% grade 5
    }


def create_model(config: Optional[ModelConfig] = None, pretrained: bool = True) -> WoundSeverityModel:
    """
    Factory function to create wound severity model.
    
    Args:
        config: Model configuration (uses default if None)
        pretrained: Use ImageNet pretrained weights
        
    Returns:
        Initialized WoundSeverityModel
    """
    if config is None:
        config = ModelConfig()
    
    model = WoundSeverityModel(
        num_classes=config.NUM_CLASSES,
        dropout_rate=config.DROPOUT_RATE,
        pretrained=pretrained
    )
    
    return model


def load_pretrained_model(checkpoint_path: str, device: str = "cpu") -> WoundSeverityModel:
    """
    Load pretrained wound severity model from checkpoint.
    
    Args:
        checkpoint_path: Path to model checkpoint (.pth file)
        device: Device to load model on ("cpu" or "cuda")
        
    Returns:
        Loaded model in eval mode
    """
    model = create_model(pretrained=False)
    
    # Load checkpoint
    checkpoint = torch.load(checkpoint_path, map_location=device)
    
    if 'model_state_dict' in checkpoint:
        model.load_state_dict(checkpoint['model_state_dict'])
    else:
        model.load_state_dict(checkpoint)
    
    model.to(device)
    model.eval()
    
    logger.info(f"Loaded pretrained model from {checkpoint_path}")
    return model


def get_model_summary(model: WoundSeverityModel) -> Dict:
    """
    Get model architecture summary.
    
    Args:
        model: WoundSeverityModel instance
        
    Returns:
        Dictionary with model statistics
    """
    total_params = sum(p.numel() for p in model.parameters())
    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    
    return {
        "model_name": "WoundSeverityModel",
        "backbone": "EfficientNet-B0",
        "num_classes": model.num_classes,
        "total_parameters": total_params,
        "trainable_parameters": trainable_params,
        "model_size_mb": total_params * 4 / (1024 * 1024),  # Assuming float32
        "dropout_rate": model.dropout_rate
    }


# Example usage
if __name__ == "__main__":
    # Create model
    model = create_model()
    
    # Print summary
    summary = get_model_summary(model)
    print("Model Summary:")
    for key, value in summary.items():
        print(f"  {key}: {value}")
    
    # Test forward pass
    dummy_input = torch.randn(1, 3, 224, 224)
    with torch.no_grad():
        output = model(dummy_input)
        probabilities = model.predict_proba(dummy_input)
        predictions, confidence = model.predict(dummy_input)
    
    print(f"\nTest forward pass:")
    print(f"  Input shape: {dummy_input.shape}")
    print(f"  Output shape: {output.shape}")
    print(f"  Predicted class: {predictions.item()}")
    print(f"  Confidence: {confidence.item():.3f}")
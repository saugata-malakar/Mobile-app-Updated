"""
Asymmetric Focal Loss for Wound Tissue Classification
Week 3 - Sharif's Implementation

Clinical rationale:
- Missing cellulitis (active infection) is dangerous → high penalty for false negatives
- Missing eschar (necrosis) is also serious → higher penalty
- False positives (over-diagnosis) are less clinically harmful
"""

import torch
import torch.nn as nn
import torch.nn.functional as F


class AsymmetricFocalLoss(nn.Module):
    """
    Focal loss with asymmetric penalties.
    
    Penalties are higher for missing critical classes:
    - Cellulitis (active infection): Highest penalty (clinically dangerous to miss)
    - Eschar (necrosis): High penalty (indicates severe condition)
    - Slough: Medium penalty (stalled healing)
    - Granulation: Lowest penalty (healthy tissue)
    
    Args:
        alpha: Scaling factor for class imbalance
        gamma: Focusing parameter (higher = more focus on hard examples)
        class_weights: Custom weights for each class
        asymmetry_factor: Multiplier for critical classes (cellulitis, eschar)
    """
    
    def __init__(
        self,
        alpha: float = 1.0,
        gamma: float = 2.0,
        class_weights: list = None,
        asymmetry_factor: float = 2.0
    ):
        super().__init__()
        
        self.alpha = alpha
        self.gamma = gamma
        
        # Default weights emphasizing critical classes
        # Order: [Granulation, Slough, Eschar, Cellulitis]
        if class_weights is None:
            # Higher weights for clinically critical classes
            self.class_weights = torch.tensor([1.0, 1.5, 2.5, 3.0])
        else:
            self.class_weights = torch.tensor(class_weights)
        
        self.asymmetry_factor = asymmetry_factor
        
    def forward(
        self, 
        logits: torch.Tensor, 
        targets: torch.Tensor
    ) -> torch.Tensor:
        """
        Compute asymmetric focal loss.
        
        Args:
            logits: Model outputs (batch, num_classes)
            targets: Ground truth labels (batch,)
            
        Returns:
            Loss value
        """
        # Compute probabilities
        probs = F.softmax(logits, dim=1)
        
        # One-hot encode targets
        targets_onehot = F.one_hot(targets, num_classes=probs.size(1)).float()
        
        # Focal weights
        pt = (probs * targets_onehot).sum(dim=1)
        focal_weight = (1 - pt) ** self.gamma
        
        # Asymmetric class weights
        # Multiply weights for critical classes (eschar=2, cellulitis=3)
        critical_mask = torch.zeros_like(targets_onehot)
        critical_mask[:, 2] = 1  # Eschar
        critical_mask[:, 3] = 1  # Cellulitis
        
        asymmetric_weights = self.class_weights.to(logits.device)
        asymmetric_weights = asymmetric_weights * (
            1 + (self.asymmetry_factor - 1) * critical_mask
        )
        
        # Apply weights
        weights = asymmetric_weights.unsqueeze(0) * targets_onehot
        weights = weights.sum(dim=1)
        
        # Cross entropy with focal weighting
        ce_loss = F.cross_entropy(logits, targets, reduction='none')
        
        # Apply focal and class weights
        loss = weights * focal_weight * ce_loss
        
        return loss.mean()


class CellulitisSensitivityLoss(nn.Module):
    """
    Custom loss that enforces high sensitivity for cellulitis.
    
    Combines focal loss with explicit penalty for missing cellulitis cases.
    """
    
    def __init__(
        self,
        cellulitis_penalty: float = 5.0,
        gamma: float = 2.0
    ):
        super().__init__()
        
        self.cellulitis_penalty = cellulitis_penalty
        self.gamma = gamma
        
    def forward(
        self,
        logits: torch.Tensor,
        targets: torch.Tensor
    ) -> torch.Tensor:
        # Standard focal loss
        focal = AsymmetricFocalLoss(gamma=self.gamma)
        base_loss = focal(logits, targets)
        
        # Additional penalty for missing cellulitis
        cellulitis_class = 3
        cellulitis_mask = (targets == cellulitis_class)
        
        if cellulitis_mask.sum() > 0:
            # Get probabilities for cellulitis class
            cellulitis_probs = F.softmax(logits, dim=1)[:, cellulitis_class]
            
            # Penalize low confidence for actual cellulitis cases
            missed_cellulitis = (cellulitis_mask) & (cellulitis_probs < 0.5)
            
            if missed_cellulitis.sum() > 0:
                penalty = self.cellulitis_penalty * (
                    (0.5 - cellulitis_probs[missed_cellulitis]) ** 2
                ).mean()
                
                return base_loss + penalty
        
        return base_loss


def get_loss_function(loss_type: str = "asymmetric_focal") -> nn.Module:
    """
    Factory function to get loss function.
    
    Args:
        loss_type: Type of loss function
            - "asymmetric_focal": Standard asymmetric focal loss
            - "cellulitis_sensitivity": High penalty for missing cellulitis
            - "weighted_ce": Weighted cross-entropy
    
    Returns:
        Loss function module
    """
    losses = {
        "asymmetric_focal": AsymmetricFocalLoss(),
        "cellulitis_sensitivity": CellulitisSensitivityLoss(),
        "weighted_ce": nn.CrossEntropyLoss(
            weight=torch.tensor([1.0, 1.5, 2.5, 3.0])
        )
    }
    
    return losses.get(loss_type, AsymmetricFocalLoss())
"""
ml/skin_classifier/model.py
EfficientNet-B3 classifier for Fitzpatrick 17k  (3-class head)
"""

import torch
import torch.nn as nn
from torchvision import models
from dataset import NUM_CLASSES


def build_model(num_classes: int = NUM_CLASSES, dropout: float = 0.4) -> nn.Module:
    """
    Loads ImageNet-pretrained EfficientNet-B3.
    Replaces the final classifier with:
        Dropout(p) → Linear(1536 → num_classes)

    Why B3:
        - README names it explicitly for ml/skin_classifier/
        - B3 has 1536 feature dims vs B0's 1280 — better for fine-grained skin lesion features
        - Still mobile-exportable at ~49 MB FP16

    Args:
        num_classes : number of output classes (3 for three_partition_label)
        dropout     : dropout probability before the classifier head
    Returns:
        nn.Module ready for training
    """
    weights = models.EfficientNet_B3_Weights.IMAGENET1K_V1
    model   = models.efficientnet_b3(weights=weights)

    # Freeze all backbone layers first (will unfreeze later for fine-tuning)
    for param in model.parameters():
        param.requires_grad = False

    # Replace classifier head — always trainable
    in_features = model.classifier[1].in_features   # 1536 for B3
    model.classifier = nn.Sequential(
        nn.Dropout(p=dropout, inplace=True),
        nn.Linear(in_features, num_classes),
    )

    return model


def unfreeze_backbone(model: nn.Module, unfreeze_from_block: int = 5):
    """
    Unfreeze EfficientNet-B3 blocks from `unfreeze_from_block` onward.
    Call this after the warm-up phase to enable full fine-tuning.

    EfficientNet-B3 has blocks 0–6.  Default: unfreeze blocks 5, 6 + head.
    """
    for name, param in model.named_parameters():
        # Always keep head trainable
        if "classifier" in name:
            param.requires_grad = True
            continue
        # Unfreeze selected blocks in features
        # named like: features.5.0.block.0.0.weight
        try:
            block_idx = int(name.split(".")[1])
            if block_idx >= unfreeze_from_block:
                param.requires_grad = True
        except (IndexError, ValueError):
            pass


def count_trainable(model: nn.Module) -> int:
    return sum(p.numel() for p in model.parameters() if p.requires_grad)

"""
Wound Tissue Dataset Pipeline
Week 3 - Sharif's Implementation

Four tissue classes:
0: Granulation (healthy pink/red granulation tissue)
1: Slough (yellow fibrinous tissue, stalled healing)
2: Eschar (black/brown necrotic tissue)
3: Cellulitis (red spreading inflammation/infection)

Periwound binary classification:
0: Normal (no spreading redness)
1: Periwound redness (redness extending beyond wound margin)
"""

import os
import random
import numpy as np
import torch
from torch.utils.data import Dataset, DataLoader
from PIL import Image
from pathlib import Path
from typing import List, Tuple, Dict, Optional
import torchvision.transforms as transforms


class WoundTissueDataset(Dataset):
    """
    Dataset for wound tissue classification.
    
    Expects directory structure:
    data_root/
    ├── granulation/
    │   ├── img001.jpg
    │   └── ...
    ├── slough/
    │   ├── img001.jpg
    │   └── ...
    ├── eschar/
    │   ├── img001.jpg
    │   └── ...
    └── cellulitis/
        ├── img001.jpg
        └── ...
    
    Or combined structure:
    data_root/
    └── tissue/
        ├── granulation/
        ├── slough/
        ├── eschar/
        └── cellulitis/
    """
    
    # Class names and descriptions
    CLASS_NAMES = {
        0: "Granulation",
        1: "Slough", 
        2: "Eschar",
        3: "Cellulitis"
    }
    
    CLASS_DESCRIPTIONS = {
        0: "Healthy pink/red granulation tissue indicating active healing",
        1: "Yellow fibrinous slough indicating stalled healing",
        2: "Black/brown necrotic eschar indicating dead tissue",
        3: "Red spreading cellulitis indicating active infection"
    }
    
    def __init__(
        self,
        data_root: str = "data/wound_tissue",
        split: str = "train",
        transform=None,
        target_size: Tuple[int, int] = (224, 224),
        augment: bool = True,
        seed: int = 42
    ):
        """
        Initialize wound tissue dataset.
        
        Args:
            data_root: Root directory containing tissue classes
            split: 'train', 'val', or 'test'
            transform: Custom transforms (auto-generated if None)
            target_size: Image size (height, width)
            augment: Apply data augmentation for training
            seed: Random seed for reproducibility
        """
        self.data_root = Path(data_root)
        self.split = split
        self.target_size = target_size
        self.augment = augment and split == "train"
        self.seed = seed
        
        # Set seeds for reproducibility
        random.seed(seed)
        np.random.seed(seed)
        torch.manual_seed(seed)
        
        # Load image paths and labels
        self.data = self._load_data()
        
        # Create transform
        if transform is None:
            self.transform = self._create_transform()
        else:
            self.transform = transform
        
        print(f"[WoundTissueDataset] Loaded {len(self.data)} {split} samples")
        
    def _load_data(self) -> List[Tuple[str, int]]:
        """Load image paths and labels."""
        data = []
        
        # Class mapping
        class_map = {
            "granulation": 0,
            "slough": 1,
            "eschar": 2,
            "cellulitis": 3
        }
        
        # Try different directory structures
        for class_name, label in class_map.items():
            # Try: data_root/class_name/
            class_dir = self.data_root / class_name
            if class_dir.exists():
                for img_path in class_dir.glob("*.jpg"):
                    data.append((str(img_path), label))
                continue
            
            # Try: data_root/tissue/class_name/
            tissue_dir = self.data_root / "tissue" / class_name
            if tissue_dir.exists():
                for img_path in tissue_dir.glob("*.jpg"):
                    data.append((str(img_path), label))
                continue
        
        # Shuffle data
        random.shuffle(data)
        
        return data
    
    def _create_transform(self):
        """Create image transforms."""
        if self.augment:
            return transforms.Compose([
                transforms.Resize(self.target_size),
                transforms.RandomHorizontalFlip(p=0.5),
                transforms.RandomVerticalFlip(p=0.3),
                transforms.RandomRotation(degrees=15),
                transforms.ColorJitter(
                    brightness=0.2,
                    contrast=0.2,
                    saturation=0.1,
                    hue=0.05
                ),
                transforms.RandomAffine(
                    degrees=0,
                    translate=(0.1, 0.1),
                    scale=(0.9, 1.1)
                ),
                transforms.ToTensor(),
                transforms.Normalize(
                    mean=[0.485, 0.456, 0.406],
                    std=[0.229, 0.224, 0.225]
                )
            ])
        else:
            return transforms.Compose([
                transforms.Resize(self.target_size),
                transforms.ToTensor(),
                transforms.Normalize(
                    mean=[0.485, 0.456, 0.406],
                    std=[0.229, 0.224, 0.225]
                )
            ])
    
    def __len__(self) -> int:
        return len(self.data)
    
    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, int]:
        """Get image and label."""
        img_path, label = self.data[idx]
        
        # Load and convert image
        image = Image.open(img_path).convert('RGB')
        
        # Apply transform
        if self.transform:
            image = self.transform(image)
        
        return image, label
    
    def get_class_distribution(self) -> Dict[int, Dict]:
        """Get class distribution statistics."""
        labels = [label for _, label in self.data]
        unique, counts = np.unique(labels, return_counts=True)
        
        distribution = {}
        for label, count in zip(unique, counts):
            distribution[label] = {
                "count": int(count),
                "percentage": round(count / len(self.data) * 100, 2),
                "name": self.CLASS_NAMES[label]
            }
        
        return distribution


class PeriwoundDataset(Dataset):
    """
    Binary dataset for periwound redness classification.
    
    Detects if redness extends beyond wound margin (cellulitis indicator).
    
    Classes:
    0: Normal (no periwound redness)
    1: Periwound redness (spreading redness)
    """
    
    CLASS_NAMES = {0: "Normal", 1: "Periwound Redness"}
    
    def __init__(
        self,
        data_root: str = "data/periwound",
        split: str = "train",
        transform=None,
        target_size: Tuple[int, int] = (224, 224),
        augment: bool = True,
        seed: int = 42
    ):
        self.data_root = Path(data_root)
        self.split = split
        self.target_size = target_size
        self.augment = augment and split == "train"
        self.seed = seed
        
        random.seed(seed)
        np.random.seed(seed)
        torch.manual_seed(seed)
        
        self.data = self._load_data()
        self.transform = transform or self._create_transform()
        
        print(f"[PeriwoundDataset] Loaded {len(self.data)} {split} samples")
    
    def _load_data(self) -> List[Tuple[str, int]]:
        data = []
        
        class_map = {
            "normal": 0,
            "periwound": 1
        }
        
        for class_name, label in class_map.items():
            class_dir = self.data_root / class_name
            if class_dir.exists():
                for img_path in class_dir.glob("*.jpg"):
                    data.append((str(img_path), label))
        
        random.shuffle(data)
        return data
    
    def _create_transform(self):
        if self.augment:
            return transforms.Compose([
                transforms.Resize(self.target_size),
                transforms.RandomHorizontalFlip(p=0.5),
                transforms.ColorJitter(brightness=0.2, contrast=0.2),
                transforms.ToTensor(),
                transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
            ])
        else:
            return transforms.Compose([
                transforms.Resize(self.target_size),
                transforms.ToTensor(),
                transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
            ])
    
    def __len__(self):
        return len(self.data)
    
    def __getitem__(self, idx):
        img_path, label = self.data[idx]
        image = Image.open(img_path).convert('RGB')
        image = self.transform(image) if self.transform else image
        return image, label


def create_tissue_data_loaders(
    data_root: str = "data/wound_tissue",
    batch_size: int = 32,
    num_workers: int = 0,
    target_size: Tuple[int, int] = (224, 224)
) -> Dict[str, DataLoader]:
    """
    Create data loaders for tissue classification.
    
    Returns:
        Dictionary with 'train', 'val', 'test' loaders
    """
    loaders = {}
    
    for split in ['train', 'val', 'test']:
        dataset = WoundTissueDataset(
            data_root=data_root,
            split=split,
            target_size=target_size,
            augment=(split == 'train')
        )
        
        loaders[split] = DataLoader(
            dataset,
            batch_size=batch_size,
            shuffle=(split == 'train'),
            num_workers=num_workers,
            pin_memory=True,
            drop_last=(split == 'train')
        )
    
    return loaders


def create_periwound_data_loaders(
    data_root: str = "data/periwound",
    batch_size: int = 32,
    num_workers: int = 0,
    target_size: Tuple[int, int] = (224, 224)
) -> Dict[str, DataLoader]:
    """Create data loaders for periwound classification."""
    loaders = {}
    
    for split in ['train', 'val', 'test']:
        dataset = PeriwoundDataset(
            data_root=data_root,
            split=split,
            target_size=target_size,
            augment=(split == 'train')
        )
        
        loaders[split] = DataLoader(
            dataset,
            batch_size=batch_size,
            shuffle=(split == 'train'),
            num_workers=num_workers,
            pin_memory=True
        )
    
    return loaders
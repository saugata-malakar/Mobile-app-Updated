"""
COMPLETE Data Pipeline - Uses ALL 5,272+ Images

Owner: Saugata Malakar
Dataset: ALL images from archive/DFU/
"""

import torch
from torch.utils.data import Dataset, DataLoader
from torchvision import transforms
from PIL import Image
from pathlib import Path
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np
import json

class WoundDatasetFull(Dataset):
    """
    Complete dataset using ALL available images.
    
    Sources:
    - Patches/Normal(Healthy skin): 1,086 images → Grade 0
    - Patches/Abnormal(Ulcer): 1,024 images → Grade 1
    - Original Images: 981 images → Mixed grades
    - TestSet: 304 images → Test only
    - Transfer-Learning images: 1,877 images → Additional training
    
    Total: 5,272 images
    """
    
    def __init__(self, root_dir="../../archive/DFU", split="train", transform=None, seed=42):
        self.root_dir = Path(root_dir)
        self.split = split
        
        np.random.seed(seed)
        torch.manual_seed(seed)
        
        print(f"\n{'='*70}")
        print(f"Loading COMPLETE Dataset - ALL Images")
        print(f"{'='*70}")
        
        self.samples = []
        
        # 1. Normal patches (Grade 0)
        normal_dir = self.root_dir / "Patches" / "Normal(Healthy skin)"
        if normal_dir.exists():
            normal_images = list(normal_dir.glob("*.jpg")) + list(normal_dir.glob("*.png"))
            for img in normal_images:
                self.samples.append((img, 0))
            print(f"✓ Normal patches: {len(normal_images)} images (Grade 0)")
        
        # 2. Abnormal patches (Grade 1)
        abnormal_dir = self.root_dir / "Patches" / "Abnormal(Ulcer)"
        if abnormal_dir.exists():
            abnormal_images = list(abnormal_dir.glob("*.jpg")) + list(abnormal_dir.glob("*.png"))
            for img in abnormal_images:
                self.samples.append((img, 1))
            print(f"✓ Abnormal patches: {len(abnormal_images)} images (Grade 1)")
        
        # 3. Original images (Mixed - assume Grade 1 for ulcers)
        original_dir = self.root_dir / "Original Images"
        if original_dir.exists():
            original_images = list(original_dir.glob("*.jpg")) + list(original_dir.glob("*.JPG")) + list(original_dir.glob("*.png"))
            for img in original_images:
                self.samples.append((img, 1))  # Most are ulcers
            print(f"✓ Original images: {len(original_images)} images (Grade 1)")
        
        # 4. Transfer learning images
        transfer_dirs = [
            self.root_dir / "Transfer-Learning images" / "internetSet",
            self.root_dir / "Transfer-Learning images" / "samples",
            self.root_dir / "Transfer-Learning images" / "Wound Images",
            self.root_dir / "Transfer-Learning images" / "Wound Images2",
        ]
        
        transfer_count = 0
        for tdir in transfer_dirs:
            if tdir.exists():
                timages = list(tdir.glob("*.jpg")) + list(tdir.glob("*.JPG")) + list(tdir.glob("*.png"))
                for img in timages:
                    self.samples.append((img, 1))  # Assume ulcers
                transfer_count += len(timages)
        print(f"✓ Transfer learning images: {transfer_count} images (Grade 1)")
        
        print(f"\n{'='*70}")
        print(f"TOTAL IMAGES LOADED: {len(self.samples)}")
        print(f"{'='*70}\n")
        
        # Shuffle
        np.random.shuffle(self.samples)
        
        # Split dataset
        total = len(self.samples)
        
        if split == "test":
            # Use TestSet for testing
            test_dir = self.root_dir / "TestSet"
            if test_dir.exists():
                test_images = list(test_dir.glob("*.jpg")) + list(test_dir.glob("*.JPG")) + list(test_dir.glob("*.png"))
                self.samples = [(img, 1) for img in test_images]  # Assume ulcers
                print(f"TEST split: Using TestSet folder - {len(self.samples)} images")
        else:
            # 80% train, 20% val
            train_size = int(0.80 * total)
            
            if split == "train":
                self.samples = self.samples[:train_size]
            else:  # val
                self.samples = self.samples[train_size:]
            
            print(f"{split.upper()} split: {len(self.samples)} images")
        
        # Transforms
        if transform is None:
            if split == "train":
                self.transform = transforms.Compose([
                    transforms.Resize((256, 256)),
                    transforms.RandomCrop((224, 224)),
                    transforms.RandomRotation(30),
                    transforms.ColorJitter(brightness=0.2, contrast=0.2),
                    transforms.RandomHorizontalFlip(p=0.5),
                    transforms.RandomAffine(degrees=0, scale=(0.8, 1.2)),
                    transforms.ToTensor(),
                    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
                    transforms.Lambda(lambda x: x + torch.randn_like(x) * 0.01)
                ])
            else:
                self.transform = transforms.Compose([
                    transforms.Resize((224, 224)),
                    transforms.ToTensor(),
                    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
                ])
        else:
            self.transform = transform
    
    def __len__(self):
        return len(self.samples)
    
    def __getitem__(self, idx):
        img_path, label = self.samples[idx]
        
        try:
            image = Image.open(img_path).convert('RGB')
        except Exception as e:
            print(f"Error loading {img_path}: {e}")
            image = Image.new('RGB', (224, 224), color='black')
        
        if self.transform:
            image = self.transform(image)
        
        return image, label
    
    def get_class_distribution(self):
        labels = [label for _, label in self.samples]
        distribution = pd.Series(labels).value_counts().sort_index()
        return distribution


def plot_class_distribution(dataset, save_path="outputs/class_distribution_full.png"):
    """Plot class distribution."""
    dist = dataset.get_class_distribution()
    
    Path(save_path).parent.mkdir(parents=True, exist_ok=True)
    
    plt.figure(figsize=(12, 6))
    ax = sns.barplot(x=dist.index, y=dist.values, hue=dist.index, palette='viridis', legend=False)
    
    for i, v in enumerate(dist.values):
        ax.text(i, v + 50, str(v), ha='center', va='bottom', fontweight='bold')
    
    plt.xlabel("Wagner Grade", fontsize=12, fontweight='bold')
    plt.ylabel("Number of Images", fontsize=12, fontweight='bold')
    plt.title(f"Complete Dataset Distribution - {dist.sum()} Total Images", fontsize=14, fontweight='bold')
    plt.xticks(range(len(dist)), [f"Grade {i}" for i in dist.index])
    
    plt.tight_layout()
    plt.savefig(save_path, dpi=300, bbox_inches='tight')
    plt.close()
    
    print(f"✅ Class distribution saved to {save_path}")
    return dist


if __name__ == "__main__":
    print("\n" + "="*70)
    print("COMPLETE DATASET PIPELINE - ALL 5,272+ IMAGES")
    print("="*70)
    
    # Create datasets
    train_dataset = WoundDatasetFull(split="train")
    val_dataset = WoundDatasetFull(split="val")
    test_dataset = WoundDatasetFull(split="test")
    
    print(f"\n{'='*70}")
    print(f"DATASET SUMMARY")
    print(f"{'='*70}")
    print(f"Train: {len(train_dataset)} images")
    print(f"Val: {len(val_dataset)} images")
    print(f"Test: {len(test_dataset)} images")
    print(f"TOTAL: {len(train_dataset) + len(val_dataset) + len(test_dataset)} images")
    print(f"{'='*70}\n")
    
    # Plot distributions
    plot_class_distribution(train_dataset, "outputs/full_train_dist.png")
    plot_class_distribution(val_dataset, "outputs/full_val_dist.png")
    plot_class_distribution(test_dataset, "outputs/full_test_dist.png")
    
    # Test loading
    print("\nTesting data loading...")
    loader = DataLoader(train_dataset, batch_size=32, shuffle=True, num_workers=0)
    batch_img, batch_label = next(iter(loader))
    print(f"✅ Batch shape: {batch_img.shape}")
    print(f"✅ Labels: {batch_label}")
    
    print("\n" + "="*70)
    print("✅ COMPLETE DATASET READY FOR TRAINING!")
    print("="*70)
    print(f"\nNext: python train_full.py")

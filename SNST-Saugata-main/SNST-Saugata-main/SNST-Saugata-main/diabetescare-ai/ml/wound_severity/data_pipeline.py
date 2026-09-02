"""
DataPipeline for Wound Severity Model Training
Owner: Sharif Hossain Sarkar (implemented by Saugata Malakar)

Week 1 Deliverable:
- DataPipeline class with augmentation
- Class distribution chart
- Unit tests
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
from collections import Counter
import json


class WoundDataPipeline(Dataset):
    """
    Dataset pipeline for wound severity classification.
    
    Augmentation (training only):
    - Rotation ±30°
    - Brightness ±20%
    - Zoom 0.8–1.2×
    - Horizontal flip
    - Gaussian noise
    
    Normalization: ImageNet mean/std [0.485, 0.456, 0.406], [0.229, 0.224, 0.225]
    
    Target: 224×224 resize for EfficientNet-B0
    """
    
    def __init__(self, root_dir="../../archive/DFU", split="train", transform=None, seed=42):
        """
        Args:
            root_dir: Path to DFU dataset (relative to ml/wound_severity/)
            split: 'train', 'val', or 'test'
            transform: Optional custom transforms
            seed: Random seed for reproducibility
        """
        self.root_dir = Path(root_dir)
        self.split = split
        
        # Set random seed for reproducibility
        np.random.seed(seed)
        torch.manual_seed(seed)
        
        # Load images from patches
        self.abnormal_dir = self.root_dir / "Patches" / "Abnormal(Ulcer)"
        self.normal_dir = self.root_dir / "Patches" / "Normal(Healthy skin)"
        
        # Check if directories exist
        if not self.abnormal_dir.exists():
            raise FileNotFoundError(f"Abnormal directory not found: {self.abnormal_dir}")
        if not self.normal_dir.exists():
            raise FileNotFoundError(f"Normal directory not found: {self.normal_dir}")
        
        # Load all images
        self.abnormal_images = sorted(list(self.abnormal_dir.glob("*.jpg")))
        self.normal_images = sorted(list(self.normal_dir.glob("*.jpg")))
        
        print(f"Found {len(self.abnormal_images)} abnormal images")
        print(f"Found {len(self.normal_images)} normal images")
        
        # Create samples with labels
        # Wagner Grade Classification:
        # 0: Normal (no ulcer)
        # 1: Superficial ulcer (default for now - needs manual labeling)
        # 2-5: Deep ulcers (need manual labeling from filenames or metadata)
        
        self.samples = []
        
        # Normal images (Wagner grade 0)
        for img in self.normal_images:
            self.samples.append((img, 0))
        
        # Abnormal images (Wagner grade 1 as placeholder)
        # TODO: Parse filenames or use metadata for proper Wagner grades
        for img in self.abnormal_images:
            self.samples.append((img, 1))
        
        # Shuffle samples
        np.random.shuffle(self.samples)
        
        # Split dataset (70% train, 15% val, 15% test)
        total = len(self.samples)
        train_size = int(0.70 * total)
        val_size = int(0.15 * total)
        
        if split == "train":
            self.samples = self.samples[:train_size]
        elif split == "val":
            self.samples = self.samples[train_size:train_size+val_size]
        else:  # test
            self.samples = self.samples[train_size+val_size:]
        
        print(f"{split.upper()} split: {len(self.samples)} images")
        
        # Transforms
        if transform is None:
            if split == "train":
                # Training augmentation
                self.transform = transforms.Compose([
                    transforms.Resize((256, 256)),  # Slightly larger for random crop
                    transforms.RandomCrop((224, 224)),
                    transforms.RandomRotation(30),  # ±30°
                    transforms.ColorJitter(brightness=0.2, contrast=0.2),  # ±20%
                    transforms.RandomHorizontalFlip(p=0.5),
                    transforms.RandomAffine(degrees=0, scale=(0.8, 1.2)),  # Zoom 0.8-1.2×
                    transforms.ToTensor(),
                    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
                    # Add Gaussian noise
                    transforms.Lambda(lambda x: x + torch.randn_like(x) * 0.01)
                ])
            else:
                # Validation/test (no augmentation)
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
            print(f"Error loading image {img_path}: {e}")
            # Return a black image as fallback
            image = Image.new('RGB', (224, 224), color='black')
        
        if self.transform:
            image = self.transform(image)
        
        return image, label
    
    def get_class_distribution(self):
        """Return class distribution for weighted loss calculation."""
        labels = [label for _, label in self.samples]
        distribution = pd.Series(labels).value_counts().sort_index()
        return distribution
    
    def get_class_names(self):
        """Return Wagner grade class names."""
        return {
            0: "Grade 0 (Normal)",
            1: "Grade 1 (Superficial)",
            2: "Grade 2 (Deep)",
            3: "Grade 3 (Abscess)",
            4: "Grade 4 (Localized gangrene)",
            5: "Grade 5 (Extensive gangrene)"
        }


def plot_class_distribution(dataset, save_path="outputs/class_distribution.png"):
    """
    Plot and save class distribution chart.
    
    Week 1 Deliverable: Class distribution chart
    """
    dist = dataset.get_class_distribution()
    class_names = dataset.get_class_names()
    
    # Create output directory if it doesn't exist
    Path(save_path).parent.mkdir(parents=True, exist_ok=True)
    
    # Plot
    plt.figure(figsize=(12, 6))
    
    # Bar plot
    ax = sns.barplot(x=dist.index, y=dist.values, palette='viridis')
    
    # Add value labels on bars
    for i, v in enumerate(dist.values):
        ax.text(i, v + 5, str(v), ha='center', va='bottom', fontweight='bold')
    
    # Labels
    plt.xlabel("Wagner Grade", fontsize=12, fontweight='bold')
    plt.ylabel("Number of Images", fontsize=12, fontweight='bold')
    plt.title("Wound Severity Class Distribution (Dataset Split)", fontsize=14, fontweight='bold')
    
    # Add class names as x-tick labels
    plt.xticks(range(len(dist)), [class_names.get(i, f"Grade {i}") for i in dist.index], rotation=45, ha='right')
    
    plt.tight_layout()
    plt.savefig(save_path, dpi=300, bbox_inches='tight')
    plt.close()
    
    print(f"✅ Class distribution chart saved to {save_path}")
    
    return dist


def get_weighted_loss(dataset):
    """
    Calculate class weights for weighted cross-entropy loss.
    
    Strategy:
    - Balance classes using inverse frequency
    - Penalize under-grading more (multiply severe grades by 1.5)
    - Clinical priority: Missing severe grades is worse than over-flagging
    """
    dist = dataset.get_class_distribution()
    total = dist.sum()
    
    # Inverse frequency weighting
    weights = total / (len(dist) * dist)
    
    # Penalize under-grading: Multiply severe grades (3-5) by 1.5
    for grade in range(3, 6):
        if grade in weights.index:
            weights[grade] *= 1.5
    
    print("\n📊 Class Weights (for weighted loss):")
    for grade, weight in weights.items():
        print(f"  Grade {grade}: {weight:.4f}")
    
    return torch.FloatTensor(weights.values)


def save_dataset_metadata(train_dataset, val_dataset, test_dataset, save_path="outputs/dataset_metadata.json"):
    """Save dataset metadata for reproducibility."""
    metadata = {
        "total_images": len(train_dataset) + len(val_dataset) + len(test_dataset),
        "train_size": len(train_dataset),
        "val_size": len(val_dataset),
        "test_size": len(test_dataset),
        "train_distribution": train_dataset.get_class_distribution().to_dict(),
        "val_distribution": val_dataset.get_class_distribution().to_dict(),
        "test_distribution": test_dataset.get_class_distribution().to_dict(),
        "class_names": train_dataset.get_class_names(),
        "augmentation": {
            "rotation": "±30°",
            "brightness": "±20%",
            "zoom": "0.8-1.2×",
            "horizontal_flip": True,
            "gaussian_noise": "σ=0.01"
        },
        "normalization": {
            "mean": [0.485, 0.456, 0.406],
            "std": [0.229, 0.224, 0.225]
        },
        "image_size": "224×224"
    }
    
    Path(save_path).parent.mkdir(parents=True, exist_ok=True)
    with open(save_path, 'w') as f:
        json.dump(metadata, f, indent=2)
    
    print(f"✅ Dataset metadata saved to {save_path}")
    return metadata


# ============================================================================
# UNIT TESTS
# ============================================================================

def test_data_pipeline():
    """
    Unit test for DataPipeline.
    
    Week 1 Deliverable: Unit tested DataPipeline class
    """
    print("\n" + "="*70)
    print("🧪 RUNNING UNIT TESTS FOR DATA PIPELINE")
    print("="*70)
    
    try:
        # Test 1: Dataset loads
        print("\n[Test 1] Loading dataset...")
        dataset = WoundDataPipeline(split="train")
        assert len(dataset) > 0, "❌ Dataset is empty"
        print(f"✅ Dataset loaded: {len(dataset)} images")
        
        # Test 2: Image shape is correct
        print("\n[Test 2] Checking image shape...")
        img, label = dataset[0]
        assert img.shape == (3, 224, 224), f"❌ Wrong shape: {img.shape}"
        print(f"✅ Image shape correct: {img.shape}")
        
        # Test 3: Labels are valid
        print("\n[Test 3] Validating labels...")
        assert 0 <= label <= 5, f"❌ Invalid label: {label}"
        print(f"✅ Label valid: {label} (Wagner Grade)")
        
        # Test 4: Pixel values are normalized
        print("\n[Test 4] Checking normalization...")
        assert img.min() >= -3 and img.max() <= 3, f"❌ Values not normalized: min={img.min()}, max={img.max()}"
        print(f"✅ Pixel values normalized: min={img.min():.2f}, max={img.max():.2f}")
        
        # Test 5: Class distribution
        print("\n[Test 5] Computing class distribution...")
        dist = dataset.get_class_distribution()
        print(f"✅ Class distribution:\n{dist}")
        
        # Test 6: Weighted loss
        print("\n[Test 6] Computing class weights...")
        weights = get_weighted_loss(dataset)
        print(f"✅ Class weights computed: {weights}")
        
        # Test 7: DataLoader works
        print("\n[Test 7] Testing DataLoader...")
        loader = DataLoader(dataset, batch_size=4, shuffle=True, num_workers=0)
        batch_img, batch_label = next(iter(loader))
        assert batch_img.shape == (4, 3, 224, 224), f"❌ Wrong batch shape: {batch_img.shape}"
        print(f"✅ DataLoader works: batch shape {batch_img.shape}")
        
        # Test 8: All splits work
        print("\n[Test 8] Testing all splits...")
        train_ds = WoundDataPipeline(split="train")
        val_ds = WoundDataPipeline(split="val")
        test_ds = WoundDataPipeline(split="test")
        total = len(train_ds) + len(val_ds) + len(test_ds)
        print(f"✅ All splits work:")
        print(f"   Train: {len(train_ds)} ({len(train_ds)/total*100:.1f}%)")
        print(f"   Val: {len(val_ds)} ({len(val_ds)/total*100:.1f}%)")
        print(f"   Test: {len(test_ds)} ({len(test_ds)/total*100:.1f}%)")
        
        print("\n" + "="*70)
        print("✅ ALL TESTS PASSED!")
        print("="*70)
        
        return True
        
    except Exception as e:
        print(f"\n❌ TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False


# ============================================================================
# MAIN EXECUTION
# ============================================================================

if __name__ == "__main__":
    print("\n" + "="*70)
    print("🚀 WOUND SEVERITY DATA PIPELINE - WEEK 1 DELIVERABLE")
    print("="*70)
    
    # Run unit tests first
    if not test_data_pipeline():
        print("\n❌ Unit tests failed. Fix errors before proceeding.")
        exit(1)
    
    print("\n" + "="*70)
    print("📊 GENERATING DELIVERABLES")
    print("="*70)
    
    # Create datasets
    print("\n[1/4] Creating train/val/test splits...")
    train_dataset = WoundDataPipeline(split="train")
    val_dataset = WoundDataPipeline(split="val")
    test_dataset = WoundDataPipeline(split="test")
    
    # Plot class distribution
    print("\n[2/4] Plotting class distribution...")
    plot_class_distribution(train_dataset, "outputs/class_distribution_train.png")
    plot_class_distribution(val_dataset, "outputs/class_distribution_val.png")
    plot_class_distribution(test_dataset, "outputs/class_distribution_test.png")
    
    # Save metadata
    print("\n[3/4] Saving dataset metadata...")
    metadata = save_dataset_metadata(train_dataset, val_dataset, test_dataset)
    
    # Print summary
    print("\n[4/4] Summary:")
    print(f"  Total images: {metadata['total_images']}")
    print(f"  Train: {metadata['train_size']} images")
    print(f"  Val: {metadata['val_size']} images")
    print(f"  Test: {metadata['test_size']} images")
    
    print("\n" + "="*70)
    print("✅ WEEK 1 DELIVERABLES COMPLETE!")
    print("="*70)
    print("\nGenerated files:")
    print("  1. outputs/class_distribution_train.png")
    print("  2. outputs/class_distribution_val.png")
    print("  3. outputs/class_distribution_test.png")
    print("  4. outputs/dataset_metadata.json")
    print("\nNext steps:")
    print("  1. Setup Weights & Biases (W&B)")
    print("  2. Share W&B project with analytics engineer")
    print("  3. Begin Week 2: Model training")

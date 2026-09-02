"""
COMPLETE Training Script - Uses ALL 4,217 Images

Owner: Saugata Malakar
Dataset: 3,130 train + 783 val + 304 test = 4,217 total images
Target: ≥75% accuracy
"""

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader
from tqdm import tqdm
import numpy as np
from pathlib import Path
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.metrics import confusion_matrix, classification_report
import json
from datetime import datetime

from data_pipeline_full import WoundDatasetFull
from model import WoundSeverityModel

# Configuration
BATCH_SIZE = 32
LEARNING_RATE = 1e-4
EPOCHS_PHASE1 = 5
EPOCHS_PHASE2 = 15
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
MODEL_SAVE_PATH = "../../models/wound_severity_FULL.pth"
OUTPUTS_DIR = "outputs"

print(f"\n{'='*70}")
print(f"🚀 COMPLETE WOUND SEVERITY MODEL TRAINING")
print(f"   Using ALL 4,217 Images from Dataset")
print(f"{'='*70}")
print(f"Device: {DEVICE}")
print(f"Batch size: {BATCH_SIZE}")
print(f"Learning rate: {LEARNING_RATE}")
print(f"Total epochs: {EPOCHS_PHASE1 + EPOCHS_PHASE2}")
print(f"{'='*70}\n")

Path(OUTPUTS_DIR).mkdir(exist_ok=True)
Path(MODEL_SAVE_PATH).parent.mkdir(parents=True, exist_ok=True)

# Load datasets
print("[1/8] Loading COMPLETE dataset...")
train_dataset = WoundDatasetFull(root_dir="../../archive/DFU", split="train")
val_dataset = WoundDatasetFull(root_dir="../../archive/DFU", split="val")
test_dataset = WoundDatasetFull(root_dir="../../archive/DFU", split="test")

print(f"\n✅ Train: {len(train_dataset)} images")
print(f"✅ Val: {len(val_dataset)} images")
print(f"✅ Test: {len(test_dataset)} images")
print(f"✅ TOTAL: {len(train_dataset) + len(val_dataset) + len(test_dataset)} images")

# Create data loaders
print("\n[2/8] Creating data loaders...")
train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True, num_workers=0)
val_loader = DataLoader(val_dataset, batch_size=BATCH_SIZE, shuffle=False, num_workers=0)
test_loader = DataLoader(test_dataset, batch_size=BATCH_SIZE, shuffle=False, num_workers=0)

print(f"✅ Train batches: {len(train_loader)}")
print(f"✅ Val batches: {len(val_loader)}")
print(f"✅ Test batches: {len(test_loader)}")

# Create model
print("\n[3/8] Creating model...")
model = WoundSeverityModel(num_classes=6, dropout_rate=0.3, pretrained=True)
model = model.to(DEVICE)
print(f"✅ Model created: EfficientNet-B0")
print(f"✅ Parameters: {sum(p.numel() for p in model.parameters()):,}")

# Get class weights
print("\n[4/8] Computing class weights...")
class_dist = train_dataset.get_class_distribution()
class_weights_dict = {}
for grade in range(6):
    if grade in class_dist.index:
        class_weights_dict[grade] = len(train_dataset) / (6 * class_dist[grade])
    else:
        class_weights_dict[grade] = 1.0

class_weights = torch.FloatTensor([class_weights_dict[i] for i in range(6)]).to(DEVICE)
print(f"Class weights: {class_weights}")

criterion = nn.CrossEntropyLoss(weight=class_weights)
optimizer = optim.Adam(model.parameters(), lr=LEARNING_RATE)
scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode='max', patience=3, factor=0.5)

history = {
    'train_loss': [],
    'train_acc': [],
    'val_loss': [],
    'val_acc': [],
    'lr': []
}

def train_epoch(model, loader, criterion, optimizer, device):
    model.train()
    total_loss = 0
    correct = 0
    total = 0
    
    pbar = tqdm(loader, desc="Training")
    for images, labels in pbar:
        images, labels = images.to(device), labels.to(device)
        
        optimizer.zero_grad()
        logits = model(images)
        loss = criterion(logits, labels)
        loss.backward()
        optimizer.step()
        
        total_loss += loss.item()
        _, predicted = logits.max(1)
        total += labels.size(0)
        correct += predicted.eq(labels).sum().item()
        
        pbar.set_postfix({'loss': f'{loss.item():.4f}', 'acc': f'{100.*correct/total:.2f}%'})
    
    return total_loss / len(loader), 100. * correct / total

def validate(model, loader, criterion, device):
    model.eval()
    total_loss = 0
    correct = 0
    total = 0
    all_preds = []
    all_labels = []
    
    with torch.no_grad():
        pbar = tqdm(loader, desc="Validation")
        for images, labels in pbar:
            images, labels = images.to(device), labels.to(device)
            logits = model(images)
            loss = criterion(logits, labels)
            
            total_loss += loss.item()
            _, predicted = logits.max(1)
            total += labels.size(0)
            correct += predicted.eq(labels).sum().item()
            
            all_preds.extend(predicted.cpu().numpy())
            all_labels.extend(labels.cpu().numpy())
            
            pbar.set_postfix({'loss': f'{loss.item():.4f}', 'acc': f'{100.*correct/total:.2f}%'})
    
    return total_loss / len(loader), 100. * correct / total, all_preds, all_labels

# PHASE 1
print("\n[5/8] PHASE 1: Training with frozen backbone...")
print(f"Epochs: {EPOCHS_PHASE1}")
for param in model.backbone.parameters():
    param.requires_grad = False

best_val_acc = 0
for epoch in range(EPOCHS_PHASE1):
    print(f"\nEpoch {epoch+1}/{EPOCHS_PHASE1}")
    print("-" * 70)
    
    train_loss, train_acc = train_epoch(model, train_loader, criterion, optimizer, DEVICE)
    val_loss, val_acc, _, _ = validate(model, val_loader, criterion, DEVICE)
    
    history['train_loss'].append(train_loss)
    history['train_acc'].append(train_acc)
    history['val_loss'].append(val_loss)
    history['val_acc'].append(val_acc)
    history['lr'].append(optimizer.param_groups[0]['lr'])
    
    print(f"\nResults:")
    print(f"  Train Loss: {train_loss:.4f} | Train Acc: {train_acc:.2f}%")
    print(f"  Val Loss: {val_loss:.4f} | Val Acc: {val_acc:.2f}%")
    
    if val_acc > best_val_acc:
        best_val_acc = val_acc
        torch.save(model.state_dict(), MODEL_SAVE_PATH)
        print(f"  ✅ Saved best model (val_acc: {val_acc:.2f}%)")

# PHASE 2
print(f"\n[6/8] PHASE 2: Fine-tuning backbone...")
print(f"Epochs: {EPOCHS_PHASE2}")
for param in model.backbone.parameters():
    param.requires_grad = True

optimizer = optim.Adam(model.parameters(), lr=LEARNING_RATE / 10)

for epoch in range(EPOCHS_PHASE2):
    print(f"\nEpoch {EPOCHS_PHASE1 + epoch+1}/{EPOCHS_PHASE1 + EPOCHS_PHASE2}")
    print("-" * 70)
    
    train_loss, train_acc = train_epoch(model, train_loader, criterion, optimizer, DEVICE)
    val_loss, val_acc, val_preds, val_labels = validate(model, val_loader, criterion, DEVICE)
    
    history['train_loss'].append(train_loss)
    history['train_acc'].append(train_acc)
    history['val_loss'].append(val_loss)
    history['val_acc'].append(val_acc)
    history['lr'].append(optimizer.param_groups[0]['lr'])
    
    print(f"\nResults:")
    print(f"  Train Loss: {train_loss:.4f} | Train Acc: {train_acc:.2f}%")
    print(f"  Val Loss: {val_loss:.4f} | Val Acc: {val_acc:.2f}%")
    
    scheduler.step(val_acc)
    
    if val_acc > best_val_acc:
        best_val_acc = val_acc
        torch.save(model.state_dict(), MODEL_SAVE_PATH)
        print(f"  ✅ Saved best model (val_acc: {val_acc:.2f}%)")

# FINAL EVALUATION
print(f"\n[7/8] Final evaluation on test set...")
model.load_state_dict(torch.load(MODEL_SAVE_PATH))
test_loss, test_acc, test_preds, test_labels = validate(model, test_loader, criterion, DEVICE)

print(f"\n{'='*70}")
print(f"📊 FINAL RESULTS")
print(f"{'='*70}")
print(f"Best Validation Accuracy: {best_val_acc:.2f}%")
print(f"Test Accuracy: {test_acc:.2f}%")
print(f"Test Loss: {test_loss:.4f}")

if test_acc >= 75.0:
    print(f"✅ TARGET MET! (≥75% accuracy)")
else:
    print(f"⚠️  Below target (need ≥75%, got {test_acc:.2f}%)")

print(f"\n📋 Classification Report:")
print(classification_report(test_labels, test_preds, 
                          target_names=['Grade 0', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5'],
                          zero_division=0))

# Confusion matrix
print(f"\n[8/8] Generating visualizations...")
cm = confusion_matrix(test_labels, test_preds)
plt.figure(figsize=(10, 8))
sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', 
            xticklabels=['G0', 'G1', 'G2', 'G3', 'G4', 'G5'],
            yticklabels=['G0', 'G1', 'G2', 'G3', 'G4', 'G5'])
plt.xlabel('Predicted Wagner Grade')
plt.ylabel('True Wagner Grade')
plt.title(f'Confusion Matrix - Test Accuracy: {test_acc:.2f}% (4,217 images trained)')
plt.tight_layout()
plt.savefig(f'{OUTPUTS_DIR}/confusion_matrix_FULL.png', dpi=300, bbox_inches='tight')
print(f"✅ Confusion matrix saved")

# Training history
fig, axes = plt.subplots(1, 2, figsize=(15, 5))

axes[0].plot(history['train_loss'], label='Train Loss', marker='o')
axes[0].plot(history['val_loss'], label='Val Loss', marker='s')
axes[0].set_xlabel('Epoch')
axes[0].set_ylabel('Loss')
axes[0].set_title('Training and Validation Loss')
axes[0].legend()
axes[0].grid(True)

axes[1].plot(history['train_acc'], label='Train Acc', marker='o')
axes[1].plot(history['val_acc'], label='Val Acc', marker='s')
axes[1].axhline(y=75, color='r', linestyle='--', label='Target (75%)')
axes[1].set_xlabel('Epoch')
axes[1].set_ylabel('Accuracy (%)')
axes[1].set_title('Training and Validation Accuracy')
axes[1].legend()
axes[1].grid(True)

plt.tight_layout()
plt.savefig(f'{OUTPUTS_DIR}/training_history_FULL.png', dpi=300, bbox_inches='tight')
print(f"✅ Training history saved")

# Save metadata
metadata = {
    'timestamp': datetime.now().isoformat(),
    'device': str(DEVICE),
    'dataset_size': {
        'train': len(train_dataset),
        'val': len(val_dataset),
        'test': len(test_dataset),
        'total': len(train_dataset) + len(val_dataset) + len(test_dataset)
    },
    'batch_size': BATCH_SIZE,
    'learning_rate': LEARNING_RATE,
    'epochs': EPOCHS_PHASE1 + EPOCHS_PHASE2,
    'best_val_acc': float(best_val_acc),
    'test_acc': float(test_acc),
    'test_loss': float(test_loss),
    'target_met': test_acc >= 75.0,
    'model_path': MODEL_SAVE_PATH,
    'history': history
}

with open(f'{OUTPUTS_DIR}/training_metadata_FULL.json', 'w') as f:
    json.dump(metadata, f, indent=2)
print(f"✅ Metadata saved")

# Export ONNX
print(f"\nExporting ONNX model...")
try:
    dummy_input = torch.randn(1, 3, 224, 224).to(DEVICE)
    onnx_path = MODEL_SAVE_PATH.replace('.pth', '.onnx')
    torch.onnx.export(model, dummy_input, onnx_path, input_names=['input'], output_names=['logits'])
    print(f"✅ ONNX model saved to {onnx_path}")
except Exception as e:
    print(f"⚠️  ONNX export failed: {e}")

print(f"\n{'='*70}")
print(f"🎉 TRAINING COMPLETE!")
print(f"{'='*70}")
print(f"\nGenerated files:")
print(f"  1. {MODEL_SAVE_PATH} - Best model checkpoint")
print(f"  2. {OUTPUTS_DIR}/confusion_matrix_FULL.png")
print(f"  3. {OUTPUTS_DIR}/training_history_FULL.png")
print(f"  4. {OUTPUTS_DIR}/training_metadata_FULL.json")
print(f"\nDataset used: 4,217 images (3,130 train + 783 val + 304 test)")
print(f"Final test accuracy: {test_acc:.2f}%")
print(f"\n{'='*70}\n")

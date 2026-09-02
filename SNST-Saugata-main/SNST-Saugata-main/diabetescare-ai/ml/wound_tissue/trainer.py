"""
Wound Tissue Training Pipeline
Week 3 - Sharif's Implementation

Training logic for:
1. WoundTissueCNN (4-class tissue classification)
2. PeriwoundClassifier (binary periwound detection)
"""

import os
import sys
import time
import json
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader
from typing import Dict, List, Optional, Tuple
from pathlib import Path
from tqdm import tqdm
import numpy as np

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from ml.wound_tissue.model import WoundTissueCNN, PeriwoundClassifier
from ml.wound_tissue.loss import AsymmetricFocalLoss, get_loss_function
from ml.wound_tissue.data_pipeline import WoundTissueDataset, PeriwoundDataset


class TissueTrainer:
    """
    Trainer for wound tissue classification model.
    
    Features:
    - Two-phase training (frozen backbone + fine-tuning)
    - Asymmetric loss for critical classes
    - Per-class accuracy tracking
    - Cellulitis sensitivity monitoring
    - Model checkpointing
    """
    
    def __init__(
        self,
        model: WoundTissueCNN,
        train_loader: DataLoader,
        val_loader: DataLoader,
        test_loader: DataLoader = None,
        device: str = "cuda",
        learning_rate: float = 0.001,
        checkpoint_dir: str = "models/wound_tissue"
    ):
        self.model = model.to(device)
        self.train_loader = train_loader
        self.val_loader = val_loader
        self.test_loader = test_loader
        self.device = device
        self.checkpoint_dir = Path(checkpoint_dir)
        self.checkpoint_dir.mkdir(parents=True, exist_ok=True)
        
        # Loss function with asymmetric penalties
        self.criterion = AsymmetricFocalLoss(
            gamma=2.0,
            asymmetry_factor=2.0
        )
        
        # Optimizer
        self.optimizer = optim.AdamW(
            model.get_parameters(),
            lr=learning_rate,
            weight_decay=0.01
        )
        
        # Learning rate scheduler
        self.scheduler = optim.lr_scheduler.ReduceLROnPlateau(
            self.optimizer,
            mode='max',
            factor=0.5,
            patience=3,
            verbose=True
        )
        
        # Training history
        self.history = {
            'train_loss': [],
            'train_acc': [],
            'val_loss': [],
            'val_acc': [],
            'val_per_class_acc': {},
            'cellulitis_sensitivity': [],
            'learning_rates': []
        }
        
        # Best metrics
        self.best_val_acc = 0.0
        self.best_cellulitis_sens = 0.0
        
        print(f"[TissueTrainer] Initialized on {device}")
        print(f"[TissueTrainer] Training samples: {len(train_loader.dataset)}")
        print(f"[TissueTrainer] Validation samples: {len(val_loader.dataset)}")
    
    def train_phase1(
        self,
        num_epochs: int = 5,
        unfreeze_top: float = 0.2
    ):
        """
        Phase 1: Train with frozen backbone.
        
        Only the classification head is trained.
        """
        print(f"\n{'='*60}")
        print("PHASE 1: Training with Frozen Backbone")
        print(f"{'='*60}")
        
        # Freeze backbone
        self.model.freeze_backbone()
        
        for epoch in range(1, num_epochs + 1):
            print(f"\n--- Epoch {epoch}/{num_epochs} ---")
            
            # Train
            train_loss, train_acc = self._train_epoch()
            
            # Validate
            val_loss, val_acc, per_class_acc, cellulitis_sens = self._validate()
            
            # Record history
            self.history['train_loss'].append(train_loss)
            self.history['train_acc'].append(train_acc)
            self.history['val_loss'].append(val_loss)
            self.history['val_acc'].append(val_acc)
            self.history['cellulitis_sensitivity'].append(cellulitis_sens)
            self.history['learning_rates'].append(
                self.optimizer.param_groups[0]['lr']
            )
            
            # Per-class accuracy
            for class_id, acc in per_class_acc.items():
                if class_id not in self.history['val_per_class_acc']:
                    self.history['val_per_class_acc'][class_id] = []
                self.history['val_per_class_acc'][class_id].append(acc)
            
            # Print progress
            print(f"Train Loss: {train_loss:.4f}, Acc: {train_acc:.2f}%")
            print(f"Val Loss: {val_loss:.4f}, Acc: {val_acc:.2f}%")
            print(f"Cellulitis Sensitivity: {cellulitis_sens:.2f}%")
            
            # Per-class accuracy
            class_names = ["Granulation", "Slough", "Eschar", "Cellulitis"]
            for class_id, acc in per_class_acc.items():
                print(f"  {class_names[class_id]}: {acc:.2f}%")
            
            # Save checkpoint
            self._save_checkpoint(epoch, val_acc, phase=1)
            
            # Update scheduler
            self.scheduler.step(val_acc)
        
        # Unfreeze for phase 2
        self.model.unfreeze_backbone(unfreeze_top)
        print(f"\n[Phase 1 Complete] Unfreezing top {unfreeze_top*100:.0f}% of backbone")
    
    def train_phase2(
        self,
        num_epochs: int = 15,
        initial_lr: float = 0.0001
    ):
        """
        Phase 2: Fine-tune with unfrozen backbone.
        
        Lower learning rate for fine-tuning.
        """
        print(f"\n{'='*60}")
        print("PHASE 2: Fine-tuning with Unfrozen Backbone")
        print(f"{'='*60}")
        
        # Reduce learning rate
        for param_group in self.optimizer.param_groups:
            param_group['lr'] = initial_lr
        
        for epoch in range(1, num_epochs + 1):
            print(f"\n--- Epoch {epoch}/{num_epochs} ---")
            
            # Train
            train_loss, train_acc = self._train_epoch()
            
            # Validate
            val_loss, val_acc, per_class_acc, cellulitis_sens = self._validate()
            
            # Record history
            self.history['train_loss'].append(train_loss)
            self.history['train_acc'].append(train_acc)
            self.history['val_loss'].append(val_loss)
            self.history['val_acc'].append(val_acc)
            self.history['cellulitis_sensitivity'].append(cellulitis_sens)
            self.history['learning_rates'].append(
                self.optimizer.param_groups[0]['lr']
            )
            
            for class_id, acc in per_class_acc.items():
                if class_id not in self.history['val_per_class_acc']:
                    self.history['val_per_class_acc'][class_id] = []
                self.history['val_per_class_acc'][class_id].append(acc)
            
            # Print progress
            print(f"Train Loss: {train_loss:.4f}, Acc: {train_acc:.2f}%")
            print(f"Val Loss: {val_loss:.4f}, Acc: {val_acc:.2f}%")
            print(f"Cellulitis Sensitivity: {cellulitis_sens:.2f}%")
            
            # Per-class accuracy
            class_names = ["Granulation", "Slough", "Eschar", "Cellulitis"]
            for class_id, acc in per_class_acc.items():
                print(f"  {class_names[class_id]}: {acc:.2f}%")
            
            # Save checkpoint
            self._save_checkpoint(epoch, val_acc, phase=2)
            
            # Update scheduler
            self.scheduler.step(val_acc)
        
        print(f"\n[Phase 2 Complete]")
    
    def _train_epoch(self) -> Tuple[float, float]:
        """Train for one epoch."""
        self.model.train()
        
        total_loss = 0.0
        correct = 0
        total = 0
        
        for images, labels in tqdm(self.train_loader, desc="Training"):
            images = images.to(self.device)
            labels = labels.to(self.device)
            
            # Forward
            self.optimizer.zero_grad()
            outputs = self.model(images)
            loss = self.criterion(outputs, labels)
            
            # Backward
            loss.backward()
            self.optimizer.step()
            
            # Statistics
            total_loss += loss.item()
            _, predicted = torch.max(outputs, 1)
            total += labels.size(0)
            correct += (predicted == labels).sum().item()
        
        avg_loss = total_loss / len(self.train_loader)
        accuracy = 100.0 * correct / total
        
        return avg_loss, accuracy
    
    def _validate(self) -> Tuple[float, float, Dict[float, float], float]:
        """Validate model."""
        self.model.eval()
        
        total_loss = 0.0
        correct = 0
        total = 0
        
        # Per-class statistics
        class_correct = {0: 0, 1: 0, 2: 0, 3: 0}
        class_total = {0: 0, 1: 0, 2: 0, 3: 0}
        
        with torch.no_grad():
            for images, labels in tqdm(self.val_loader, desc="Validating"):
                images = images.to(self.device)
                labels = labels.to(self.device)
                
                outputs = self.model(images)
                loss = self.criterion(outputs, labels)
                
                total_loss += loss.item()
                _, predicted = torch.max(outputs, 1)
                total += labels.size(0)
                correct += (predicted == labels).sum().item()
                
                # Per-class accuracy
                for class_id in range(4):
                    mask = (labels == class_id)
                    class_total[class_id] += mask.sum().item()
                    class_correct[class_id] += ((predicted == class_id) & mask).sum().item()
        
        avg_loss = total_loss / len(self.val_loader)
        accuracy = 100.0 * correct / total
        
        # Per-class accuracy
        per_class_acc = {}
        for class_id in range(4):
            if class_total[class_id] > 0:
                per_class_acc[class_id] = 100.0 * class_correct[class_id] / class_total[class_id]
            else:
                per_class_acc[class_id] = 0.0
        
        # Cellulitis sensitivity (recall for class 3)
        cellulitis_sens = per_class_acc.get(3, 0.0)
        
        return avg_loss, accuracy, per_class_acc, cellulitis_sens
    
    def _save_checkpoint(self, epoch: int, val_acc: float, phase: int):
        """Save model checkpoint."""
        # Save best model
        if val_acc > self.best_val_acc:
            self.best_val_acc = val_acc
            self.model.save(self.checkpoint_dir / "best_model.pth")
            print(f"  [New Best] Val Accuracy: {val_acc:.2f}%")
        
        # Save phase checkpoint
        checkpoint = {
            'epoch': epoch,
            'phase': phase,
            'model_state_dict': self.model.state_dict(),
            'optimizer_state_dict': self.optimizer.state_dict(),
            'val_acc': val_acc,
            'history': self.history
        }
        torch.save(checkpoint, self.checkpoint_dir / f"checkpoint_phase{phase}_epoch{epoch}.pth")
    
    def evaluate_test_set(self) -> Dict:
        """Final evaluation on test set."""
        if self.test_loader is None:
            print("[TissueTrainer] No test loader provided")
            return {}
        
        self.model.eval()
        
        total_loss = 0.0
        correct = 0
        total = 0
        
        class_correct = {0: 0, 1: 0, 2: 0, 3: 0}
        class_total = {0: 0, 1: 0, 2: 0, 3: 0}
        
        all_preds = []
        all_labels = []
        
        with torch.no_grad():
            for images, labels in tqdm(self.test_loader, desc="Test Evaluation"):
                images = images.to(self.device)
                labels = labels.to(self.device)
                
                outputs = self.model(images)
                loss = self.criterion(outputs, labels)
                
                total_loss += loss.item()
                _, predicted = torch.max(outputs, 1)
                total += labels.size(0)
                correct += (predicted == labels).sum().item()
                
                for class_id in range(4):
                    mask = (labels == class_id)
                    class_total[class_id] += mask.sum().item()
                    class_correct[class_id] += ((predicted == class_id) & mask).sum().item()
                
                all_preds.extend(predicted.cpu().numpy())
                all_labels.extend(labels.cpu().numpy())
        
        # Calculate metrics
        test_loss = total_loss / len(self.test_loader)
        test_acc = 100.0 * correct / total
        
        per_class_acc = {}
        for class_id in range(4):
            if class_total[class_id] > 0:
                per_class_acc[class_id] = 100.0 * class_correct[class_id] / class_total[class_id]
        
        # Cellulitis sensitivity (CRITICAL METRIC)
        cellulitis_sens = per_class_acc.get(3, 0.0)
        
        print(f"\n{'='*60}")
        print("TEST SET EVALUATION RESULTS")
        print(f"{'='*60}")
        print(f"Overall Accuracy: {test_acc:.2f}%")
        print(f"Test Loss: {test_loss:.4f}")
        print(f"\nPer-Class Accuracy:")
        
        class_names = ["Granulation", "Slough", "Eschar", "Cellulitis"]
        for class_id, acc in per_class_acc.items():
            marker = "✓" if acc >= 85.0 else "✗"
            print(f"  {marker} {class_names[class_id]}: {acc:.2f}%")
        
        print(f"\nCellulitis Sensitivity: {cellulitis_sens:.2f}%")
        if cellulitis_sens >= 90.0:
            print("✓ Meets ≥90% cellulitis sensitivity target!")
        else:
            print(f"✗ Below 90% target (gap: {90.0 - cellulitis_sens:.2f}%)")
        
        print(f"{'='*60}")
        
        return {
            'test_loss': test_loss,
            'test_accuracy': test_acc,
            'per_class_accuracy': per_class_acc,
            'cellulitis_sensitivity': cellulitis_sens,
            'all_preds': all_preds,
            'all_labels': all_labels
        }
    
    def save_history(self, filepath: str = "training_history.json"):
        """Save training history to JSON."""
        with open(filepath, 'w') as f:
            json.dump(self.history, f, indent=2)
        print(f"[TissueTrainer] History saved to {filepath}")


class PeriwoundTrainer:
    """
    Trainer for periwound binary classifier.
    """
    
    def __init__(
        self,
        model: PeriwoundClassifier,
        train_loader: DataLoader,
        val_loader: DataLoader,
        device: str = "cuda",
        learning_rate: float = 0.001
    ):
        self.model = model.to(device)
        self.train_loader = train_loader
        self.val_loader = val_loader
        self.device = device
        
        self.criterion = nn.BCEWithLogitsLoss()
        self.optimizer = optim.AdamW(model.get_parameters(), lr=learning_rate)
        
        self.history = {'train_loss': [], 'val_loss': [], 'val_acc': []}
    
    def train(self, num_epochs: int = 10):
        """Train periwound classifier."""
        print(f"\n{'='*60}")
        print("Training Periwound Classifier")
        print(f"{'='*60}")
        
        for epoch in range(1, num_epochs + 1):
            print(f"\n--- Epoch {epoch}/{num_epochs} ---")
            
            # Train
            train_loss = self._train_epoch()
            
            # Validate
            val_loss, val_acc = self._validate()
            
            self.history['train_loss'].append(train_loss)
            self.history['val_loss'].append(val_loss)
            self.history['val_acc'].append(val_acc)
            
            print(f"Train Loss: {train_loss:.4f}")
            print(f"Val Loss: {val_loss:.4f}, Val Acc: {val_acc:.2f}%")
    
    def _train_epoch(self) -> float:
        self.model.train()
        total_loss = 0.0
        
        for images, labels in tqdm(self.train_loader, desc="Training"):
            images = images.to(self.device)
            labels = labels.float().to(self.device)
            
            self.optimizer.zero_grad()
            logits = self.model(images)
            loss = self.criterion(logits, labels)
            loss.backward()
            self.optimizer.step()
            
            total_loss += loss.item()
        
        return total_loss / len(self.train_loader)
    
    def _validate(self) -> Tuple[float, float]:
        self.model.eval()
        total_loss = 0.0
        correct = 0
        total = 0
        
        with torch.no_grad():
            for images, labels in self.val_loader:
                images = images.to(self.device)
                labels = labels.float().to(self.device)
                
                logits = self.model(images)
                loss = self.criterion(logits, labels)
                
                total_loss += loss.item()
                preds = (torch.sigmoid(logits) > 0.5).long()
                total += labels.size(0)
                correct += (preds == labels).sum().item()
        
        return total_loss / len(self.val_loader), 100.0 * correct / total
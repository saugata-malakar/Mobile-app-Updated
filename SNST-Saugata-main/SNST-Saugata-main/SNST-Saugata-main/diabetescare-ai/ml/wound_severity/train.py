"""
Wound Severity Model Training Script

Implements EfficientNet-B0 training pipeline for Wagner grade classification.
Includes data augmentation, class balancing, early stopping, and W&B logging.

Owner: Saugata Malakar (covering Sharif's role)
Target: ≥75% top-1 accuracy on DFU dataset
"""

import os
import sys
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, WeightedRandomSampler
from torchvision import transforms
import wandb
import numpy as np
from sklearn.metrics import classification_report, confusion_matrix
from typing import Dict, List, Tuple, Optional
import logging
from datetime import datetime
import json

# Add project root to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))

from ml.wound_severity.model import WoundSeverityModel, WoundSeverityLoss, ModelConfig
from ml.wound_severity.data_pipeline import WoundDataset, get_data_loaders

logger = logging.getLogger(__name__)


class WoundSeverityTrainer:
    """
    Training pipeline for wound severity classification.
    
    Features:
    - EfficientNet-B0 with transfer learning
    - Class-weighted loss for imbalanced data
    - Data augmentation and regularization
    - Early stopping with validation monitoring
    - W&B experiment tracking
    - Model checkpointing
    """
    
    def __init__(
        self,
        config: Optional[ModelConfig] = None,
        experiment_name: str = "wound_severity_training",
        device: str = "auto"
    ):
        """
        Initialize trainer.
        
        Args:
            config: Training configuration
            experiment_name: W&B experiment name
            device: Training device ("auto", "cpu", "cuda")
        """
        self.config = config or ModelConfig()
        self.experiment_name = experiment_name
        
        # Set device
        if device == "auto":
            self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        else:
            self.device = torch.device(device)
        
        logger.info(f"Training device: {self.device}")
        
        # Initialize components
        self.model = None
        self.optimizer = None
        self.scheduler = None
        self.criterion = None
        self.train_loader = None
        self.val_loader = None
        self.test_loader = None
        
        # Training state
        self.current_epoch = 0
        self.best_val_accuracy = 0.0
        self.best_model_state = None
        self.training_history = {
            "train_loss": [],
            "train_accuracy": [],
            "val_loss": [],
            "val_accuracy": []
        }
        
        # Early stopping
        self.patience_counter = 0
        self.early_stop = False
    
    def setup_model(self):
        """Initialize model, loss, optimizer, and scheduler."""
        # Create model
        self.model = WoundSeverityModel(
            num_classes=self.config.NUM_CLASSES,
            dropout_rate=self.config.DROPOUT_RATE,
            pretrained=True
        ).to(self.device)
        
        # Loss function with class weights
        class_weights = torch.tensor([1.0, 1.2, 1.0, 1.5, 3.0, 5.0]).to(self.device)
        self.criterion = WoundSeverityLoss(class_weights=class_weights)
        
        # Optimizer
        self.optimizer = optim.AdamW(
            self.model.parameters(),
            lr=self.config.LEARNING_RATE,
            weight_decay=self.config.WEIGHT_DECAY
        )
        
        # Learning rate scheduler
        self.scheduler = optim.lr_scheduler.ReduceLROnPlateau(
            self.optimizer,
            mode='max',
            factor=0.5,
            patience=5,
            verbose=True
        )
        
        logger.info("Model, optimizer, and scheduler initialized")
    
    def setup_data(self, data_dir: str):
        """
        Setup data loaders.
        
        Args:
            data_dir: Path to DFU dataset directory
        """
        # Get data loaders from data pipeline
        self.train_loader, self.val_loader, self.test_loader = get_data_loaders(
            data_dir=data_dir,
            batch_size=self.config.BATCH_SIZE,
            image_size=self.config.IMAGE_SIZE,
            num_workers=4
        )
        
        logger.info(f"Data loaders created:")
        logger.info(f"  Train batches: {len(self.train_loader)}")
        logger.info(f"  Val batches: {len(self.val_loader)}")
        logger.info(f"  Test batches: {len(self.test_loader)}")
    
    def train_epoch(self) -> Tuple[float, float]:
        """
        Train for one epoch.
        
        Returns:
            (average_loss, accuracy)
        """
        self.model.train()
        running_loss = 0.0
        correct_predictions = 0
        total_samples = 0
        
        for batch_idx, (images, labels) in enumerate(self.train_loader):
            images, labels = images.to(self.device), labels.to(self.device)
            
            # Forward pass
            self.optimizer.zero_grad()
            outputs = self.model(images)
            loss = self.criterion(outputs, labels)
            
            # Backward pass
            loss.backward()
            self.optimizer.step()
            
            # Statistics
            running_loss += loss.item()
            _, predicted = torch.max(outputs.data, 1)
            total_samples += labels.size(0)
            correct_predictions += (predicted == labels).sum().item()
            
            # Log batch progress
            if batch_idx % 50 == 0:
                logger.info(
                    f"Epoch {self.current_epoch}, Batch {batch_idx}/{len(self.train_loader)}, "
                    f"Loss: {loss.item():.4f}"
                )
        
        avg_loss = running_loss / len(self.train_loader)
        accuracy = correct_predictions / total_samples
        
        return avg_loss, accuracy
    
    def validate_epoch(self) -> Tuple[float, float, Dict]:
        """
        Validate for one epoch.
        
        Returns:
            (average_loss, accuracy, detailed_metrics)
        """
        self.model.eval()
        running_loss = 0.0
        correct_predictions = 0
        total_samples = 0
        all_predictions = []
        all_labels = []
        
        with torch.no_grad():
            for images, labels in self.val_loader:
                images, labels = images.to(self.device), labels.to(self.device)
                
                outputs = self.model(images)
                loss = self.criterion(outputs, labels)
                
                running_loss += loss.item()
                _, predicted = torch.max(outputs.data, 1)
                total_samples += labels.size(0)
                correct_predictions += (predicted == labels).sum().item()
                
                all_predictions.extend(predicted.cpu().numpy())
                all_labels.extend(labels.cpu().numpy())
        
        avg_loss = running_loss / len(self.val_loader)
        accuracy = correct_predictions / total_samples
        
        # Detailed metrics
        detailed_metrics = {
            "classification_report": classification_report(
                all_labels, all_predictions, 
                target_names=[f"Grade_{i}" for i in range(self.config.NUM_CLASSES)],
                output_dict=True
            ),
            "confusion_matrix": confusion_matrix(all_labels, all_predictions).tolist()
        }
        
        return avg_loss, accuracy, detailed_metrics
    
    def save_checkpoint(self, filepath: str, is_best: bool = False):
        """
        Save model checkpoint.
        
        Args:
            filepath: Path to save checkpoint
            is_best: Whether this is the best model so far
        """
        checkpoint = {
            'epoch': self.current_epoch,
            'model_state_dict': self.model.state_dict(),
            'optimizer_state_dict': self.optimizer.state_dict(),
            'scheduler_state_dict': self.scheduler.state_dict(),
            'best_val_accuracy': self.best_val_accuracy,
            'training_history': self.training_history,
            'config': self.config.__dict__
        }
        
        torch.save(checkpoint, filepath)
        
        if is_best:
            best_filepath = filepath.replace('.pth', '_best.pth')
            torch.save(checkpoint, best_filepath)
            logger.info(f"Best model saved to {best_filepath}")
    
    def load_checkpoint(self, filepath: str):
        """
        Load model checkpoint.
        
        Args:
            filepath: Path to checkpoint file
        """
        checkpoint = torch.load(filepath, map_location=self.device)
        
        self.model.load_state_dict(checkpoint['model_state_dict'])
        self.optimizer.load_state_dict(checkpoint['optimizer_state_dict'])
        self.scheduler.load_state_dict(checkpoint['scheduler_state_dict'])
        self.current_epoch = checkpoint['epoch']
        self.best_val_accuracy = checkpoint['best_val_accuracy']
        self.training_history = checkpoint['training_history']
        
        logger.info(f"Checkpoint loaded from {filepath}")
    
    def train(
        self,
        data_dir: str,
        num_epochs: Optional[int] = None,
        save_dir: str = "checkpoints",
        use_wandb: bool = True
    ) -> Dict:
        """
        Full training pipeline.
        
        Args:
            data_dir: Path to DFU dataset
            num_epochs: Number of epochs (uses config default if None)
            save_dir: Directory to save checkpoints
            use_wandb: Whether to use W&B logging
            
        Returns:
            Training results dictionary
        """
        num_epochs = num_epochs or self.config.NUM_EPOCHS
        
        # Setup
        self.setup_model()
        self.setup_data(data_dir)
        
        # Create save directory
        os.makedirs(save_dir, exist_ok=True)
        
        # Initialize W&B
        if use_wandb:
            wandb.init(
                project="diabetescare-wound-severity",
                name=self.experiment_name,
                config=self.config.__dict__
            )
            wandb.watch(self.model)
        
        logger.info(f"Starting training for {num_epochs} epochs")
        
        # Training loop
        for epoch in range(num_epochs):
            self.current_epoch = epoch + 1
            
            # Train epoch
            train_loss, train_accuracy = self.train_epoch()
            
            # Validate epoch
            val_loss, val_accuracy, detailed_metrics = self.validate_epoch()
            
            # Update learning rate
            self.scheduler.step(val_accuracy)
            
            # Update history
            self.training_history["train_loss"].append(train_loss)
            self.training_history["train_accuracy"].append(train_accuracy)
            self.training_history["val_loss"].append(val_loss)
            self.training_history["val_accuracy"].append(val_accuracy)
            
            # Log metrics
            logger.info(
                f"Epoch {self.current_epoch}/{num_epochs}: "
                f"Train Loss: {train_loss:.4f}, Train Acc: {train_accuracy:.4f}, "
                f"Val Loss: {val_loss:.4f}, Val Acc: {val_accuracy:.4f}"
            )
            
            if use_wandb:
                wandb.log({
                    "epoch": self.current_epoch,
                    "train_loss": train_loss,
                    "train_accuracy": train_accuracy,
                    "val_loss": val_loss,
                    "val_accuracy": val_accuracy,
                    "learning_rate": self.optimizer.param_groups[0]['lr']
                })
            
            # Save checkpoint
            checkpoint_path = os.path.join(save_dir, f"wound_severity_epoch_{self.current_epoch}.pth")
            is_best = val_accuracy > self.best_val_accuracy
            
            if is_best:
                self.best_val_accuracy = val_accuracy
                self.best_model_state = self.model.state_dict().copy()
                logger.info(f"New best validation accuracy: {val_accuracy:.4f}")
            
            self.save_checkpoint(checkpoint_path, is_best=is_best)
            
            # Early stopping check
            if val_accuracy > self.best_val_accuracy - self.config.MIN_DELTA:
                self.patience_counter = 0
            else:
                self.patience_counter += 1
            
            if self.patience_counter >= self.config.PATIENCE:
                logger.info(f"Early stopping triggered after {self.current_epoch} epochs")
                self.early_stop = True
                break
        
        # Final evaluation on test set
        test_results = self.evaluate_test_set()
        
        # Training summary
        results = {
            "best_val_accuracy": self.best_val_accuracy,
            "final_epoch": self.current_epoch,
            "early_stopped": self.early_stop,
            "test_results": test_results,
            "training_history": self.training_history,
            "target_achieved": self.best_val_accuracy >= self.config.TARGET_ACCURACY
        }
        
        logger.info(f"Training completed!")
        logger.info(f"Best validation accuracy: {self.best_val_accuracy:.4f}")
        logger.info(f"Target accuracy (≥{self.config.TARGET_ACCURACY}): {'✅ ACHIEVED' if results['target_achieved'] else '❌ NOT ACHIEVED'}")
        
        if use_wandb:
            wandb.log(results)
            wandb.finish()
        
        return results
    
    def evaluate_test_set(self) -> Dict:
        """
        Evaluate model on test set.
        
        Returns:
            Test evaluation results
        """
        if self.best_model_state is not None:
            self.model.load_state_dict(self.best_model_state)
        
        self.model.eval()
        correct_predictions = 0
        total_samples = 0
        all_predictions = []
        all_labels = []
        
        with torch.no_grad():
            for images, labels in self.test_loader:
                images, labels = images.to(self.device), labels.to(self.device)
                
                outputs = self.model(images)
                _, predicted = torch.max(outputs.data, 1)
                
                total_samples += labels.size(0)
                correct_predictions += (predicted == labels).sum().item()
                
                all_predictions.extend(predicted.cpu().numpy())
                all_labels.extend(labels.cpu().numpy())
        
        test_accuracy = correct_predictions / total_samples
        
        return {
            "test_accuracy": test_accuracy,
            "classification_report": classification_report(
                all_labels, all_predictions,
                target_names=[f"Grade_{i}" for i in range(self.config.NUM_CLASSES)],
                output_dict=True
            ),
            "confusion_matrix": confusion_matrix(all_labels, all_predictions).tolist()
        }


def main():
    """Main training script."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Train wound severity classification model")
    parser.add_argument("--data_dir", type=str, required=True, help="Path to DFU dataset")
    parser.add_argument("--epochs", type=int, default=50, help="Number of training epochs")
    parser.add_argument("--batch_size", type=int, default=32, help="Batch size")
    parser.add_argument("--lr", type=float, default=1e-4, help="Learning rate")
    parser.add_argument("--save_dir", type=str, default="checkpoints", help="Checkpoint save directory")
    parser.add_argument("--experiment_name", type=str, default="wound_severity_v1", help="Experiment name")
    parser.add_argument("--no_wandb", action="store_true", help="Disable W&B logging")
    parser.add_argument("--device", type=str, default="auto", help="Training device")
    
    args = parser.parse_args()
    
    # Setup logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    # Create config
    config = ModelConfig()
    config.NUM_EPOCHS = args.epochs
    config.BATCH_SIZE = args.batch_size
    config.LEARNING_RATE = args.lr
    
    # Create trainer
    trainer = WoundSeverityTrainer(
        config=config,
        experiment_name=args.experiment_name,
        device=args.device
    )
    
    # Train model
    results = trainer.train(
        data_dir=args.data_dir,
        save_dir=args.save_dir,
        use_wandb=not args.no_wandb
    )
    
    # Save results
    results_path = os.path.join(args.save_dir, "training_results.json")
    with open(results_path, 'w') as f:
        json.dump(results, f, indent=2)
    
    logger.info(f"Training results saved to {results_path}")


if __name__ == "__main__":
    main()
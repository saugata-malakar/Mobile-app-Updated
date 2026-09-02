"""
Wound Tissue Training Script
Week 3 - Sharif's Implementation

Usage:
    python train_wound_tissue.py --data_root data/wound_tissue --epochs 20
    python train_wound_tissue.py --quick --epochs 2
"""

import sys
import argparse
import torch
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from ml.wound_tissue.model import WoundTissueCNN
from ml.wound_tissue.data_pipeline import create_tissue_data_loaders
from ml.wound_tissue.trainer import TissueTrainer
from ml.wound_tissue.export import export_tissue_model


def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description="Train Wound Tissue Classifier")
    
    # Data
    parser.add_argument("--data_root", type=str, default="data/wound_tissue",
                       help="Root directory containing tissue classes")
    parser.add_argument("--batch_size", type=int, default=32,
                       help="Batch size")
    
    # Training
    parser.add_argument("--epochs", type=int, default=20,
                       help="Total epochs (phase1 + phase2)")
    parser.add_argument("--phase1_epochs", type=int, default=5,
                       help="Epochs with frozen backbone")
    parser.add_argument("--phase2_epochs", type=int, default=15,
                       help="Epochs with fine-tuning")
    parser.add_argument("--learning_rate", type=float, default=0.001,
                       help="Learning rate")
    parser.add_argument("--unfreeze_top", type=float, default=0.2,
                       help="Fraction of backbone to unfreeze in phase2")
    
    # Model
    parser.add_argument("--dropout", type=float, default=0.4,
                       help="Dropout rate")
    parser.add_argument("--checkpoint_dir", type=str, default="models/wound_tissue",
                       help="Directory to save checkpoints")
    
    # Options
    parser.add_argument("--quick", action="store_true",
                       help="Quick training with minimal epochs")
    parser.add_argument("--test_only", action="store_true",
                       help="Only run test evaluation")
    parser.add_argument("--export", action="store_true",
                       help="Export models after training")
    
    return parser.parse_args()


def main():
    args = parse_args()
    
    print("\n" + "="*70)
    print("  WOUND TISSUE CLASSIFIER TRAINING")
    print("  Week 3 - Sharif's Implementation")
    print("="*70)
    
    # Quick mode overrides
    if args.quick:
        args.epochs = 2
        args.phase1_epochs = 1
        args.phase2_epochs = 1
        args.batch_size = 16
        print("\n[Quick Mode] Using minimal training settings\n")
    
    # Device
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Device: {device}\n")
    
    # Create data loaders
    print("[1/5] Loading datasets...")
    try:
        loaders = create_tissue_data_loaders(
            data_root=args.data_root,
            batch_size=args.batch_size,
            target_size=(224, 224)
        )
        train_loader = loaders['train']
        val_loader = loaders['val']
        test_loader = loaders.get('test', None)
        
        print(f"  Train: {len(train_loader.dataset)} samples")
        print(f"  Val: {len(val_loader.dataset)} samples")
        if test_loader:
            print(f"  Test: {len(test_loader.dataset)} samples")
        
    except Exception as e:
        print(f"\n[Error] Could not load data: {e}")
        print("\nExpected directory structure:")
        print("  data_root/")
        print("  ├── granulation/")
        print("  │   └── *.jpg")
        print("  ├── slough/")
        print("  │   └── *.jpg")
        print("  ├── eschar/")
        print("  │   └── *.jpg")
        print("  └── cellulitis/")
        print("      └── *.jpg")
        print("\nPlease organize your data accordingly.")
        return
    
    # Create model
    print("\n[2/5] Initializing model...")
    model = WoundTissueCNN(
        num_classes=4,
        pretrained=True,
        dropout_rate=args.dropout,
        freeze_backbone=True,
        unfreeze_top_layers=args.unfreeze_top
    )
    
    num_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"  Model: EfficientNet-B0 based")
    print(f"  Trainable parameters: {num_params:,}")
    
    # Create trainer
    print("\n[3/5] Setting up trainer...")
    trainer = TissueTrainer(
        model=model,
        train_loader=train_loader,
        val_loader=val_loader,
        test_loader=test_loader,
        device=device,
        learning_rate=args.learning_rate,
        checkpoint_dir=args.checkpoint_dir
    )
    
    # Test only mode
    if args.test_only:
        print("\n[4/5] Running test evaluation...")
        results = trainer.evaluate_test_set()
        return
    
    # Phase 1: Frozen backbone
    print("\n[4/5] Starting training...")
    trainer.train_phase1(
        num_epochs=args.phase1_epochs,
        unfreeze_top=args.unfreeze_top
    )
    
    # Phase 2: Fine-tuning
    trainer.train_phase2(
        num_epochs=args.phase2_epochs,
        initial_lr=args.learning_rate / 10
    )
    
    # Final test evaluation
    print("\n[5/5] Final evaluation on test set...")
    test_results = trainer.evaluate_test_set()
    
    # Save training history
    trainer.save_history(f"{args.checkpoint_dir}/training_history.json")
    
    # Export models
    if args.export:
        print("\n[Bonus] Exporting models...")
        export_tissue_model(
            model,
            output_dir=args.checkpoint_dir,
            model_name="wound_tissue"
        )
    
    # Print final summary
    print("\n" + "="*70)
    print("  TRAINING COMPLETE")
    print("="*70)
    print(f"\nBest Validation Accuracy: {trainer.best_val_acc:.2f}%")
    print(f"Test Accuracy: {test_results.get('test_accuracy', 'N/A')}")
    print(f"Cellulitis Sensitivity: {test_results.get('cellulitis_sensitivity', 'N/A')}%")
    
    # Check targets
    print("\nTarget Check:")
    test_acc = test_results.get('test_accuracy', 0)
    cellulitis_sens = test_results.get('cellulitis_sensitivity', 0)
    
    if test_acc >= 85:
        print(f"  ✓ Overall accuracy ≥85%: {test_acc:.2f}%")
    else:
        print(f"  ✗ Overall accuracy <85%: {test_acc:.2f}%")
    
    if cellulitis_sens >= 90:
        print(f"  ✓ Cellulitis sensitivity ≥90%: {cellulitis_sens:.2f}%")
    else:
        print(f"  ✗ Cellulitis sensitivity <90%: {cellulitis_sens:.2f}%")
    
    print(f"\nCheckpoints saved to: {args.checkpoint_dir}")
    print("="*70 + "\n")


if __name__ == "__main__":
    main()
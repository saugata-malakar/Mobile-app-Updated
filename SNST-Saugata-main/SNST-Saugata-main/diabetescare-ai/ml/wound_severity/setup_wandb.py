"""
Weights & Biases (W&B) Setup Script
Owner: Sharif Hossain Sarkar (implemented by Saugata Malakar)

Week 1 Deliverable:
- W&B project initialized
- Shared with analytics engineer
- Ready for training logs
"""

import wandb
import os
from pathlib import Path
import json

def setup_wandb():
    """
    Setup Weights & Biases for experiment tracking.
    
    Steps:
    1. Login to W&B (requires API key)
    2. Initialize project
    3. Log dataset metadata
    4. Share project link
    """
    
    print("\n" + "="*70)
    print("🔧 WEIGHTS & BIASES SETUP")
    print("="*70)
    
    # Check if W&B is installed
    try:
        import wandb
        print("✅ W&B installed")
    except ImportError:
        print("❌ W&B not installed. Installing...")
        os.system("pip install wandb")
        import wandb
    
    # Login to W&B
    print("\n[1/5] Logging in to W&B...")
    print("If you don't have an API key:")
    print("  1. Go to https://wandb.ai/authorize")
    print("  2. Copy your API key")
    print("  3. Paste it below")
    
    try:
        wandb.login()
        print("✅ Logged in to W&B")
    except Exception as e:
        print(f"❌ Login failed: {e}")
        print("Run 'wandb login' manually in terminal")
        return False
    
    # Initialize project
    print("\n[2/5] Initializing W&B project...")
    project_name = "diabetescare-wound-severity"
    
    run = wandb.init(
        project=project_name,
        name="dataset-setup",
        tags=["week1", "data-pipeline", "setup"],
        notes="Week 1 deliverable: Dataset pipeline and class distribution"
    )
    
    print(f"✅ Project initialized: {project_name}")
    print(f"   Run URL: {run.url}")
    
    # Log dataset metadata
    print("\n[3/5] Logging dataset metadata...")
    
    # Load metadata if exists
    metadata_path = Path("outputs/dataset_metadata.json")
    if metadata_path.exists():
        with open(metadata_path, 'r') as f:
            metadata = json.load(f)
        
        # Log as W&B config
        wandb.config.update({
            "total_images": metadata["total_images"],
            "train_size": metadata["train_size"],
            "val_size": metadata["val_size"],
            "test_size": metadata["test_size"],
            "image_size": metadata["image_size"],
            "augmentation": metadata["augmentation"],
            "normalization": metadata["normalization"]
        })
        
        # Log class distributions as table
        train_dist = metadata["train_distribution"]
        val_dist = metadata["val_distribution"]
        test_dist = metadata["test_distribution"]
        
        table = wandb.Table(
            columns=["Wagner Grade", "Train", "Val", "Test"],
            data=[
                [f"Grade {grade}", train_dist.get(str(grade), 0), 
                 val_dist.get(str(grade), 0), test_dist.get(str(grade), 0)]
                for grade in range(6)
            ]
        )
        wandb.log({"class_distribution": table})
        
        print("✅ Dataset metadata logged")
    else:
        print("⚠️  Metadata file not found. Run data_pipeline.py first.")
    
    # Log class distribution charts
    print("\n[4/5] Logging class distribution charts...")
    
    chart_paths = [
        "outputs/class_distribution_train.png",
        "outputs/class_distribution_val.png",
        "outputs/class_distribution_test.png"
    ]
    
    for chart_path in chart_paths:
        if Path(chart_path).exists():
            wandb.log({Path(chart_path).stem: wandb.Image(chart_path)})
            print(f"✅ Logged {chart_path}")
        else:
            print(f"⚠️  Chart not found: {chart_path}")
    
    # Share project
    print("\n[5/5] Sharing project...")
    print(f"\n📊 W&B Project URL: {run.url}")
    print(f"   Project: {project_name}")
    print(f"   Entity: {run.entity}")
    print("\n🔗 Share this link with the analytics engineer:")
    print(f"   https://wandb.ai/{run.entity}/{project_name}")
    
    # Save project info
    project_info = {
        "project_name": project_name,
        "entity": run.entity,
        "run_url": run.url,
        "project_url": f"https://wandb.ai/{run.entity}/{project_name}"
    }
    
    with open("outputs/wandb_project_info.json", 'w') as f:
        json.dump(project_info, f, indent=2)
    
    print("\n✅ Project info saved to outputs/wandb_project_info.json")
    
    # Finish run
    wandb.finish()
    
    print("\n" + "="*70)
    print("✅ W&B SETUP COMPLETE!")
    print("="*70)
    print("\nNext steps:")
    print("  1. Share project URL with analytics engineer")
    print("  2. Begin model training (Week 2)")
    print("  3. Training logs will automatically sync to W&B")
    
    return True


def test_wandb_logging():
    """Test W&B logging with dummy data."""
    print("\n" + "="*70)
    print("🧪 TESTING W&B LOGGING")
    print("="*70)
    
    run = wandb.init(
        project="diabetescare-wound-severity",
        name="test-logging",
        tags=["test"]
    )
    
    # Log dummy metrics
    for epoch in range(5):
        wandb.log({
            "epoch": epoch,
            "train_loss": 2.5 - epoch * 0.3,
            "train_acc": 40 + epoch * 10,
            "val_loss": 2.3 - epoch * 0.25,
            "val_acc": 45 + epoch * 8
        })
    
    print(f"✅ Test logging complete: {run.url}")
    wandb.finish()


if __name__ == "__main__":
    # Setup W&B
    success = setup_wandb()
    
    if success:
        # Test logging
        print("\n" + "="*70)
        print("Would you like to test W&B logging? (y/n)")
        response = input("> ").strip().lower()
        
        if response == 'y':
            test_wandb_logging()
    else:
        print("\n❌ W&B setup failed. Please fix errors and try again.")

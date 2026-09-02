"""
Master script to complete all Day 1 deliverables.
Owner: Sharif Hossain Sarkar (implemented by Saugata Malakar)

Week 1 Deliverables:
1. DataPipeline class (unit tested)
2. Class distribution charts
3. W&B project live and shared
"""

import subprocess
import sys
from pathlib import Path

def run_command(cmd, description):
    """Run a command and handle errors."""
    print("\n" + "="*70)
    print(f"🚀 {description}")
    print("="*70)
    print(f"Command: {cmd}")
    print()
    
    result = subprocess.run(cmd, shell=True)
    
    if result.returncode != 0:
        print(f"\n❌ Failed: {description}")
        return False
    
    print(f"\n✅ Success: {description}")
    return True


def main():
    """Run all Day 1 tasks."""
    print("\n" + "="*70)
    print("🎯 DAY 1: COMPLETE ALL DELIVERABLES")
    print("="*70)
    print("\nThis script will:")
    print("  1. Test setup (dependencies, dataset)")
    print("  2. Run data pipeline (generate charts)")
    print("  3. Setup Weights & Biases")
    print("\nEstimated time: 10-15 minutes")
    print("\nPress Enter to continue or Ctrl+C to cancel...")
    input()
    
    # Step 1: Test setup
    if not run_command("python test_setup.py", "Step 1: Test Setup"):
        print("\n❌ Setup test failed. Fix errors before proceeding.")
        return 1
    
    # Step 2: Run data pipeline
    if not run_command("python data_pipeline.py", "Step 2: Data Pipeline"):
        print("\n❌ Data pipeline failed. Check errors above.")
        return 1
    
    # Step 3: Setup W&B
    print("\n" + "="*70)
    print("🚀 Step 3: Setup Weights & Biases")
    print("="*70)
    print("\nYou will need:")
    print("  1. W&B account (sign up at https://wandb.ai)")
    print("  2. API key (get from https://wandb.ai/authorize)")
    print("\nPress Enter to continue...")
    input()
    
    if not run_command("python setup_wandb.py", "Step 3: W&B Setup"):
        print("\n⚠️  W&B setup failed. You can run it manually later:")
        print("     python setup_wandb.py")
    
    # Summary
    print("\n" + "="*70)
    print("✅ DAY 1 DELIVERABLES COMPLETE!")
    print("="*70)
    
    print("\n📁 Generated files:")
    outputs_dir = Path("outputs")
    if outputs_dir.exists():
        for file in sorted(outputs_dir.glob("*")):
            print(f"  ✅ {file}")
    
    print("\n📊 Next steps:")
    print("  1. Check outputs/ directory for class distribution charts")
    print("  2. Share W&B project URL with analytics engineer")
    print("  3. Review outputs/dataset_metadata.json")
    print("  4. Begin Week 2: Model training")
    
    print("\n🔗 W&B Project:")
    wandb_info = Path("outputs/wandb_project_info.json")
    if wandb_info.exists():
        import json
        with open(wandb_info, 'r') as f:
            info = json.load(f)
        print(f"  {info['project_url']}")
    
    print("\n" + "="*70)
    print("🎉 WEEK 1 COMPLETE! Ready for Week 2 training.")
    print("="*70)
    
    return 0


if __name__ == "__main__":
    sys.exit(main())

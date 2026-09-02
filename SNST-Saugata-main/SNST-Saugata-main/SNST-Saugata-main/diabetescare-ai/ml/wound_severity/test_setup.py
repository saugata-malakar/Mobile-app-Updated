"""
Test script to verify Day 1 setup is complete.
Owner: Sharif Hossain Sarkar (implemented by Saugata Malakar)
"""

import sys
from pathlib import Path

def test_dependencies():
    """Test that all required packages are installed."""
    print("\n" + "="*70)
    print("🧪 TESTING DEPENDENCIES")
    print("="*70)
    
    required_packages = [
        'torch',
        'torchvision',
        'timm',
        'wandb',
        'numpy',
        'pandas',
        'PIL',
        'matplotlib',
        'seaborn',
        'sklearn',
        'tqdm'
    ]
    
    missing = []
    for package in required_packages:
        try:
            __import__(package)
            print(f"✅ {package}")
        except ImportError:
            print(f"❌ {package} - NOT INSTALLED")
            missing.append(package)
    
    if missing:
        print(f"\n❌ Missing packages: {', '.join(missing)}")
        print("Install with: pip install -r requirements.txt")
        return False
    
    print("\n✅ All dependencies installed!")
    return True


def test_dataset():
    """Test that dataset exists."""
    print("\n" + "="*70)
    print("🧪 TESTING DATASET")
    print("="*70)
    
    dataset_path = Path("../../archive/DFU")
    
    if not dataset_path.exists():
        print(f"❌ Dataset not found at {dataset_path.absolute()}")
        print("Expected structure:")
        print("  archive/DFU/")
        print("  ├── Patches/")
        print("  │   ├── Abnormal(Ulcer)/")
        print("  │   └── Normal(Healthy skin)/")
        print("  ├── Original Images/")
        print("  └── TestSet/")
        return False
    
    abnormal_dir = dataset_path / "Patches" / "Abnormal(Ulcer)"
    normal_dir = dataset_path / "Patches" / "Normal(Healthy skin)"
    
    if not abnormal_dir.exists():
        print(f"❌ Abnormal directory not found: {abnormal_dir}")
        return False
    
    if not normal_dir.exists():
        print(f"❌ Normal directory not found: {normal_dir}")
        return False
    
    abnormal_count = len(list(abnormal_dir.glob("*.jpg")))
    normal_count = len(list(normal_dir.glob("*.jpg")))
    
    print(f"✅ Dataset found:")
    print(f"   Abnormal images: {abnormal_count}")
    print(f"   Normal images: {normal_count}")
    print(f"   Total: {abnormal_count + normal_count}")
    
    if abnormal_count == 0 or normal_count == 0:
        print("⚠️  Warning: One or both directories are empty!")
        return False
    
    return True


def test_outputs_directory():
    """Test that outputs directory exists."""
    print("\n" + "="*70)
    print("🧪 TESTING OUTPUTS DIRECTORY")
    print("="*70)
    
    outputs_dir = Path("outputs")
    
    if not outputs_dir.exists():
        print("⚠️  Outputs directory doesn't exist. Creating...")
        outputs_dir.mkdir(parents=True, exist_ok=True)
        print("✅ Created outputs directory")
    else:
        print("✅ Outputs directory exists")
    
    return True


def test_models_directory():
    """Test that models directory exists."""
    print("\n" + "="*70)
    print("🧪 TESTING MODELS DIRECTORY")
    print("="*70)
    
    models_dir = Path("../../models")
    
    if not models_dir.exists():
        print("⚠️  Models directory doesn't exist. Creating...")
        models_dir.mkdir(parents=True, exist_ok=True)
        print("✅ Created models directory")
    else:
        print("✅ Models directory exists")
    
    return True


def test_data_pipeline():
    """Test that data_pipeline.py can be imported."""
    print("\n" + "="*70)
    print("🧪 TESTING DATA PIPELINE")
    print("="*70)
    
    try:
        from data_pipeline import WoundDataPipeline
        print("✅ data_pipeline.py can be imported")
        return True
    except Exception as e:
        print(f"❌ Failed to import data_pipeline.py: {e}")
        return False


def main():
    """Run all tests."""
    print("\n" + "="*70)
    print("🚀 DAY 1 SETUP VERIFICATION")
    print("="*70)
    
    tests = [
        ("Dependencies", test_dependencies),
        ("Dataset", test_dataset),
        ("Outputs Directory", test_outputs_directory),
        ("Models Directory", test_models_directory),
        ("Data Pipeline", test_data_pipeline)
    ]
    
    results = []
    for name, test_func in tests:
        try:
            result = test_func()
            results.append((name, result))
        except Exception as e:
            print(f"\n❌ Test '{name}' crashed: {e}")
            results.append((name, False))
    
    # Summary
    print("\n" + "="*70)
    print("📊 TEST SUMMARY")
    print("="*70)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {name}")
    
    print(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n" + "="*70)
        print("✅ ALL TESTS PASSED! Ready for Day 1 deliverables.")
        print("="*70)
        print("\nNext steps:")
        print("  1. Run: python data_pipeline.py")
        print("  2. Run: python setup_wandb.py")
        print("  3. Share W&B project with analytics engineer")
        return 0
    else:
        print("\n" + "="*70)
        print("❌ SOME TESTS FAILED. Fix errors before proceeding.")
        print("="*70)
        return 1


if __name__ == "__main__":
    sys.exit(main())

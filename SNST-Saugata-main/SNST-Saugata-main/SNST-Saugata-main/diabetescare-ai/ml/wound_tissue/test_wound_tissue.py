"""
Wound Tissue Module Test Script
Week 3 - Sharif's Implementation

Tests basic functionality without actual data.
"""

import sys
import torch
from pathlib import Path

# Add parent directory to path
project_root = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(project_root))

from ml.wound_tissue.model import WoundTissueCNN, PeriwoundClassifier, count_parameters
from ml.wound_tissue.loss import AsymmetricFocalLoss, CellulitisSensitivityLoss
from ml.wound_tissue.inference import TissueInferenceAPI
from ml.wound_tissue.data_pipeline import WoundTissueDataset, PeriwoundDataset


def test_models():
    """Test model creation and forward pass."""
    print("\n" + "="*60)
    print("Testing Models")
    print("="*60)
    
    # Test tissue model
    print("\n[1/2] Testing WoundTissueCNN...")
    tissue_model = WoundTissueCNN(
        num_classes=4,
        pretrained=False,
        freeze_backbone=True
    )
    
    # Forward pass
    dummy_input = torch.randn(2, 3, 224, 224)
    output = tissue_model(dummy_input)
    
    assert output.shape == (2, 4), f"Expected shape (2, 4), got {output.shape}"
    print(f"  ✓ Output shape: {output.shape}")
    
    # Test predict method
    pred = tissue_model.predict(dummy_input)
    assert 'logits' in pred and 'probs' in pred and 'preds' in pred
    print(f"  ✓ Predict method works")
    
    # Count parameters
    num_params = count_parameters(tissue_model)
    print(f"  ✓ Trainable parameters: {num_params:,}")
    
    # Test periwound model
    print("\n[2/2] Testing PeriwoundClassifier...")
    periwound_model = PeriwoundClassifier(pretrained=False)
    
    output = periwound_model(dummy_input)
    assert output.shape == (2,), f"Expected shape (2,), got {output.shape}"
    print(f"  ✓ Output shape: {output.shape}")
    
    pred = periwound_model.predict(dummy_input)
    assert 'logits' in pred and 'probs' in pred and 'preds' in pred
    print(f"  ✓ Predict method works")
    
    print("\n✓ All model tests passed!")


def test_loss_functions():
    """Test loss functions."""
    print("\n" + "="*60)
    print("Testing Loss Functions")
    print("="*60)
    
    # Test AsymmetricFocalLoss
    print("\n[1/2] Testing AsymmetricFocalLoss...")
    loss_fn = AsymmetricFocalLoss(gamma=2.0, asymmetry_factor=2.0)
    
    logits = torch.randn(4, 4)  # 4 samples, 4 classes
    labels = torch.tensor([0, 1, 2, 3])  # One of each class
    
    loss = loss_fn(logits, labels)
    assert loss.item() > 0, "Loss should be positive"
    print(f"  ✓ Loss computed: {loss.item():.4f}")
    
    # Test class weights
    weights = loss_fn.class_weights
    print(f"  ✓ Class weights: {weights.tolist()}")
    
    # Test CellulitisSensitivityLoss
    print("\n[2/2] Testing CellulitisSensitivityLoss...")
    cellulitis_loss = CellulitisSensitivityLoss(
        cellulitis_penalty=5.0,
        gamma=2.0
    )
    
    loss = cellulitis_loss(logits, labels)
    assert loss.item() > 0, "Loss should be positive"
    print(f"  ✓ Cellulitis loss computed: {loss.item():.4f}")
    
    print("\n✓ All loss function tests passed!")


def test_inference_api():
    """Test inference API (with mock data)."""
    print("\n" + "="*60)
    print("Testing Inference API")
    print("="*60)
    
    # Create API without models
    api = TissueInferenceAPI()
    
    # Create dummy image
    from PIL import Image
    dummy_image = Image.new('RGB', (224, 224), color='red')
    
    # Test tissue inference (will return mock)
    print("\n[1/2] Testing tissue inference...")
    result = api.infer_tissue(dummy_image)
    
    assert result['status'] == 'mock' or result['status'] == 'success'
    assert 'prediction' in result
    assert 'class_name' in result['prediction']
    assert 'confidence' in result['prediction']
    print(f"  ✓ Result: {result['prediction']['class_name']} ({result['prediction']['confidence']:.1%})")
    
    # Test periwound inference
    print("\n[2/2] Testing periwound inference...")
    result = api.infer_periwound(dummy_image)
    
    assert 'prediction' in result
    assert 'is_redness' in result['prediction']
    print(f"  ✓ Result: {'Redness' if result['prediction']['is_redness'] else 'Normal'}")
    
    print("\n✓ All inference API tests passed!")


def test_class_info():
    """Test class information."""
    print("\n" + "="*60)
    print("Testing Class Information")
    print("="*60)
    
    api = TissueInferenceAPI()
    
    print("\nTissue Classes:")
    for class_id, info in api.TISSUE_CLASSES.items():
        print(f"  {class_id}: {info['name']} ({info['severity']})")
        print(f"    → {info['description'][:50]}...")
    
    print("\n✓ Class information test passed!")


def main():
    """Run all tests."""
    print("\n" + "="*70)
    print("  WOUND TISSUE MODULE - UNIT TESTS")
    print("  Week 3 - Sharif's Implementation")
    print("="*70)
    
    try:
        test_models()
        test_loss_functions()
        test_inference_api()
        test_class_info()
        
        print("\n" + "="*70)
        print("  ALL TESTS PASSED!")
        print("="*70)
        print("\nNote: Full training requires wound tissue dataset.")
        print("Expected data structure:")
        print("  data/wound_tissue/")
        print("  ├── granulation/")
        print("  ├── slough/")
        print("  ├── eschar/")
        print("  └── cellulitis/")
        print("\nTo train:")
        print("  python ml/wound_tissue/train_wound_tissue.py --data_root data/wound_tissue")
        print("="*70 + "\n")
        
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0


if __name__ == "__main__":
    exit(main())
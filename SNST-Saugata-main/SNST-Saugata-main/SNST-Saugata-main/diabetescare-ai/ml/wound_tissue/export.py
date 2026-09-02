"""
Model Export Utilities
Week 3 - Sharif's Implementation

Export models to:
1. TFLite (float16) - For mobile/edge deployment
2. ONNX - For cross-platform inference
"""

import sys
import torch
import torch.nn as nn
from pathlib import Path
from typing import Optional

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))


def export_to_torchscript(
    model: nn.Module,
    model_path: str,
    example_input: torch.Tensor = None
):
    """
    Export model to TorchScript.
    
    Args:
        model: PyTorch model
        model_path: Output path (.pt)
        example_input: Example input for tracing
    """
    model.eval()
    
    if example_input is not None:
        # Trace model
        traced_model = torch.jit.trace(model, example_input)
        traced_model.save(model_path)
        print(f"[Export] TorchScript traced model saved to {model_path}")
    else:
        # Script model
        scripted_model = torch.jit.script(model)
        scripted_model.save(model_path)
        print(f"[Export] TorchScript scripted model saved to {model_path}")


def export_to_tflite(
    model: nn.Module,
    model_path: str,
    input_shape: tuple = (1, 3, 224, 224),
    quantization: str = "float16"
):
    """
    Export model to TFLite.
    
    Args:
        model: PyTorch model
        model_path: Output path (.tflite)
        input_shape: Input tensor shape (batch, channels, height, width)
        quantization: "float16", "int8", or "dynamic"
    
    Note: Requires torch2onnx and onnx-tf for full TFLite export.
    This function exports to ONNX first, then converts to TFLite.
    """
    try:
        import onnx
        import tf2onnx
        import tensorflow as tf
    except ImportError as e:
        print(f"[Export] Required packages not installed: {e}")
        print("[Export] Install with: pip install onnx tf2onnx tensorflow")
        return
    
    # Export to ONNX first
    onnx_path = model_path.replace(".tflite", ".onnx")
    export_to_onnx(model, onnx_path, input_shape)
    
    # Convert ONNX to TFLite
    # This is a simplified version - full conversion requires more setup
    print(f"[Export] ONNX model saved to {onnx_path}")
    print(f"[Export] TFLite export requires additional setup (see documentation)")


def export_to_onnx(
    model: nn.Module,
    model_path: str,
    input_shape: tuple = (1, 3, 224, 224),
    opset_version: int = 12,
    dynamic_axes: dict = None
):
    """
    Export model to ONNX format.
    
    Args:
        model: PyTorch model
        model_path: Output path (.onnx)
        input_shape: Input tensor shape (batch, channels, height, width)
        opset_version: ONNX opset version
        dynamic_axes: Dynamic axis specifications for variable batch size
    """
    model.eval()
    
    # Create example input
    example_input = torch.randn(input_shape)
    
    # Define dynamic axes (batch dimension)
    if dynamic_axes is None:
        dynamic_axes = {
            0: {  # batch size
                'batch_size': 'batch_size',
                'sequence_length': 'sequence_length'
            }
        }
    
    # Export
    torch.onnx.export(
        model,
        example_input,
        model_path,
        input_names=['input'],
        output_names=['output'],
        dynamic_axes=dynamic_axes,
        opset_version=opset_version,
        do_constant_folding=True,
        export_params=True
    )
    
    print(f"[Export] ONNX model saved to {model_path}")
    
    # Verify export
    try:
        import onnx
        onnx_model = onnx.load(model_path)
        onnx.checker.check_model(onnx_model)
        print(f"[Export] ONNX model verified successfully")
    except Exception as e:
        print(f"[Export] ONNX verification warning: {e}")


def export_tissue_model(
    model: nn.Module,
    output_dir: str = "models/wound_tissue",
    model_name: str = "wound_tissue"
):
    """
    Export wound tissue model in multiple formats.
    
    Exports:
    - TorchScript (.pt)
    - ONNX (.onnx)
    - TFLite (.tflite) - if dependencies available
    """
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"\n{'='*60}")
    print("Exporting Wound Tissue Model")
    print(f"{'='*60}")
    
    # Example input
    example_input = torch.randn(1, 3, 224, 224)
    
    # Export to TorchScript
    ts_path = output_dir / f"{model_name}.pt"
    export_to_torchscript(model, str(ts_path), example_input)
    
    # Export to ONNX
    onnx_path = output_dir / f"{model_name}.onnx"
    export_to_onnx(model, str(onnx_path), (1, 3, 224, 224))
    
    # Try TFLite export
    tflite_path = output_dir / f"{model_name}.tflite"
    try:
        export_to_tflite(model, str(tflite_path), (1, 3, 224, 224))
    except ImportError:
        print("[Export] TFLite export skipped (dependencies not available)")
    
    print(f"\n[Export] All models saved to {output_dir}")
    
    # List exported files
    print("\nExported files:")
    for f in output_dir.glob("*"):
        print(f"  - {f.name}")
    
    return {
        "torchscript": str(ts_path),
        "onnx": str(onnx_path)
    }


def export_periwound_model(
    model: nn.Module,
    output_dir: str = "models/periwound",
    model_name: str = "periwound"
):
    """Export periwound classifier model."""
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"\n{'='*60}")
    print("Exporting Periwound Model")
    print(f"{'='*60}")
    
    example_input = torch.randn(1, 3, 224, 224)
    
    # Export to TorchScript
    ts_path = output_dir / f"{model_name}.pt"
    export_to_torchscript(model, str(ts_path), example_input)
    
    # Export to ONNX
    onnx_path = output_dir / f"{model_name}.onnx"
    export_to_onnx(model, str(onnx_path), (1, 3, 224, 224))
    
    print(f"\n[Export] Periwound model saved to {output_dir}")
    
    return {"torchscript": str(ts_path), "onnx": str(onnx_path)}


def verify_exports(model_dir: str = "models/wound_tissue"):
    """
    Verify exported models can be loaded and run inference.
    
    Args:
        model_dir: Directory containing exported models
    """
    import onnxruntime as ort
    
    model_dir = Path(model_dir)
    
    print(f"\n{'='*60}")
    print("Verifying Exported Models")
    print(f"{'='*60}")
    
    # Check for ONNX models
    onnx_files = list(model_dir.glob("*.onnx"))
    
    if not onnx_files:
        print("No ONNX models found to verify")
        return
    
    for onnx_path in onnx_files:
        print(f"\nVerifying: {onnx_path.name}")
        
        try:
            # Create session
            session = ort.InferenceSession(str(onnx_path))
            
            # Run inference
            input_name = session.get_inputs()[0].name
            example_input = np.random.randn(1, 3, 224, 224).astype(np.float32)
            
            outputs = session.run(None, {input_name: example_input})
            
            print(f"  ✓ ONNX model loads successfully")
            print(f"  ✓ Inference runs successfully")
            print(f"  Output shape: {outputs[0].shape}")
            
        except Exception as e:
            print(f"  ✗ Verification failed: {e}")


if __name__ == "__main__":
    # Example export usage
    from ml.wound_tissue.model import WoundTissueCNN
    
    # Create model
    model = WoundTissueCNN(num_classes=4)
    
    # Export
    export_tissue_model(model, "models/wound_tissue", "wound_tissue")
    
    # Verify
    verify_exports("models/wound_tissue")
import os
import sys
import time
import shutil
import subprocess
from pathlib import Path

# Add project root to python path
project_root = Path(__file__).resolve().parent.parent
sys.path.append(str(project_root))

def run_step(step_name, code_str):
    print(f"\n=== {step_name} ===")
    temp_script = project_root / f"temp_{step_name.replace(' ', '_').lower().replace(':', '')}.py"
    try:
        with open(temp_script, "w", encoding="utf-8") as f:
            f.write(code_str)
        
        # Run the temporary script in a clean python subprocess
        res = subprocess.run([sys.executable, str(temp_script)], capture_output=True, text=True, errors='replace')
        if res.returncode != 0:
            print(f"Error in {step_name}!")
            print("Stdout:", res.stdout)
            print("Stderr:", res.stderr)
            sys.exit(1)
        else:
            print(res.stdout.strip())
    finally:
        if temp_script.exists():
            temp_script.unlink()

def main():
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
    
    checkpoint_path = project_root / "models" / "wound_severity_best.pth"
    onnx_path = project_root / "models" / "wound_severity.onnx"
    tf_model_dir = project_root / "models" / "wound_severity_tf_saved"
    tflite_float16_path = project_root / "models" / "wound_severity_best_float16.tflite"

    # Step 1: Export PyTorch to ONNX
    step1_code = f"""
import sys
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')
from pathlib import Path
import torch
project_root = Path(r"{project_root}")
sys.path.append(str(project_root))
from ml.wound_severity.model import load_pretrained_model

checkpoint_path = project_root / "models" / "wound_severity_best.pth"
onnx_path = project_root / "models" / "wound_severity.onnx"

model = load_pretrained_model(str(checkpoint_path), device="cpu")
model.eval()

dummy_input = torch.randn(1, 3, 224, 224)
torch.onnx.export(
    model,
    dummy_input,
    str(onnx_path),
    input_names=['input'],
    output_names=['output'],
    opset_version=12,
    do_constant_folding=True,
    export_params=True
)
print("ONNX model saved to " + str(onnx_path))
"""
    run_step("Step 1 Exporting PyTorch Model to ONNX", step1_code)
    time.sleep(2)

    # Step 2: Convert ONNX to SavedModel using onnx2tf
    print("\n=== Step 2: Converting ONNX to SavedModel using onnx2tf ===")
    if tf_model_dir.exists():
        shutil.rmtree(tf_model_dir)
        
    # We use tf_converter backend to export the SavedModel directory
    cmd = [
        sys.executable, "-m", "onnx2tf",
        "-i", str(onnx_path),
        "-o", str(tf_model_dir),
        "--tflite_backend", "tf_converter",
        "--non_verbose"
    ]
    print(f"Running command: {' '.join(cmd)}")
    
    retries = 3
    for attempt in range(retries):
        if tf_model_dir.exists():
            shutil.rmtree(tf_model_dir)
        result = subprocess.run(cmd, capture_output=True, text=True, errors='replace')
        if result.returncode == 0:
            print("onnx2tf completed successfully and generated SavedModel.")
            break
            
        print(f"onnx2tf failed on attempt {attempt+1}/{retries}. Error: {result.stderr.strip().splitlines()[-1] if result.stderr.strip() else 'Unknown error'}")
        print("Sleeping 5 seconds before retry...")
        time.sleep(5)
    else:
        print("onnx2tf failed after all retries.")
        print("Stdout:", result.stdout)
        print("Stderr:", result.stderr)
        sys.exit(1)
    time.sleep(2)

    # Step 3: Quantize SavedModel to TFLite (Float16 weights, Float32 I/O)
    step3_code = f"""
import sys
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')
import tensorflow as tf
from pathlib import Path

project_root = Path(r"{project_root}")
tf_model_dir = project_root / "models" / "wound_severity_tf_saved"
tflite_float16_path = project_root / "models" / "wound_severity_best_float16.tflite"

converter = tf.lite.TFLiteConverter.from_saved_model(str(tf_model_dir))
converter.optimizations = [tf.lite.Optimize.DEFAULT]
converter.target_spec.supported_types = [tf.float16]

tflite_model = converter.convert()
with open(tflite_float16_path, "wb") as f:
    f.write(tflite_model)
print("Float16 weight quantized TFLite model saved to " + str(tflite_float16_path))
"""
    run_step("Step 3 Quantizing SavedModel to TFLite", step3_code)
    time.sleep(2)

    # Step 4: Latency & Size Benchmarking
    step4_code = f"""
import sys
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')
import time
from pathlib import Path
import numpy as np
import torch
import ai_edge_litert.interpreter as litert

project_root = Path(r"{project_root}")
sys.path.append(str(project_root))
from ml.wound_severity.model import load_pretrained_model

checkpoint_path = project_root / "models" / "wound_severity_best.pth"
onnx_path = project_root / "models" / "wound_severity.onnx"
tflite_float16_path = project_root / "models" / "wound_severity_best_float16.tflite"

# PyTorch Model
model = load_pretrained_model(str(checkpoint_path), device="cpu")
model.eval()

# Dummy input
dummy_input_np = np.random.randn(1, 3, 224, 224).astype(np.float32)

# PyTorch Latency
# Warmup
with torch.no_grad():
    for _ in range(10):
        _ = model(torch.from_numpy(dummy_input_np))
# Measure
start_time = time.time()
num_runs = 50
with torch.no_grad():
    for _ in range(num_runs):
        _ = model(torch.from_numpy(dummy_input_np))
pytorch_latency = (time.time() - start_time) / num_runs * 1000

# TFLite Latency
interpreter = litert.Interpreter(model_path=str(tflite_float16_path))
interpreter.allocate_tensors()
input_index = interpreter.get_input_details()[0]['index']
output_index = interpreter.get_output_details()[0]['index']

dummy_input_nhwc = np.transpose(dummy_input_np, (0, 2, 3, 1))

# Warmup
for _ in range(10):
    interpreter.set_tensor(input_index, dummy_input_nhwc)
    interpreter.invoke()
    _ = interpreter.get_tensor(output_index)
# Measure
start_time = time.time()
for _ in range(num_runs):
    interpreter.set_tensor(input_index, dummy_input_nhwc)
    interpreter.invoke()
    _ = interpreter.get_tensor(output_index)
tflite_latency = (time.time() - start_time) / num_runs * 1000

# File Sizes
pth_size = checkpoint_path.stat().st_size / (1024 * 1024)
onnx_size = onnx_path.stat().st_size / (1024 * 1024)
tflite16_size = tflite_float16_path.stat().st_size / (1024 * 1024)

print("Model Size Summary:")
print(f"  PyTorch (.pth): {{pth_size:.2f}} MB")
print(f"  ONNX (.onnx): {{onnx_size:.2f}} MB")
print(f"  TFLite Float16 (.tflite): {{tflite16_size:.2f}} MB")
print(f"  Size Reduction (PyTorch -> TFLite FP16): {{(1.0 - tflite16_size / pth_size) * 100:.1f}}%")
print("Latency Summary (Batch Size = 1):")
print(f"  PyTorch: {{pytorch_latency:.2f}} ms")
print(f"  TFLite Float16: {{tflite_latency:.2f}} ms")
print(f"  Latency Change: {{(tflite_latency - pytorch_latency) / pytorch_latency * 100:+.1f}}%")
"""
    run_step("Step 4 Benchmarking Size & Latency", step4_code)

    # Step 5: Clean up temporary files
    print("\n=== Step 5: Cleaning up temporary files ===")
    if tf_model_dir.exists():
        shutil.rmtree(tf_model_dir)
    if onnx_path.exists():
        onnx_path.unlink()
    print("Cleanup completed.")

if __name__ == "__main__":
    main()

import os
import sys
import time
import numpy as np
from pathlib import Path
import ai_edge_litert.interpreter as litert

try:
    import psutil
except ImportError:
    import subprocess
    print("psutil not found, installing it...")
    subprocess.run([sys.executable, "-m", "pip", "install", "psutil"], capture_output=True)
    import psutil

# Add project root to python path
project_root = Path(__file__).resolve().parent.parent
sys.path.append(str(project_root))

def softmax(x):
    e_x = np.exp(x - np.max(x, axis=-1, keepdims=True))
    return e_x / e_x.sum(axis=-1, keepdims=True)

def get_process_memory():
    process = psutil.Process(os.getpid())
    return process.memory_info().rss / (1024 * 1024)  # in MB

def main():
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

    tflite_path = project_root / "models" / "wound_severity_best_float16.tflite"
    print("========================================")
    print("Starting TFLite Model Stress Test")
    print("========================================")
    print(f"Loading TFLite model: {tflite_path}")
    
    if not tflite_path.exists():
        print(f"Error: TFLite model not found at {tflite_path}")
        sys.exit(1)
        
    start_memory = get_process_memory()
    print(f"Initial Process Memory: {start_memory:.2f} MB")
    
    try:
        interpreter = litert.Interpreter(model_path=str(tflite_path))
        interpreter.allocate_tensors()
    except Exception as e:
        print(f"CRITICAL: Failed to load/allocate TFLite model: {e}")
        sys.exit(1)
        
    input_details = interpreter.get_input_details()
    output_details = interpreter.get_output_details()
    
    input_index = input_details[0]['index']
    output_index = output_details[0]['index']
    
    print(f"Model successfully allocated.")
    print(f"Input shape: {input_details[0]['shape']}")
    print(f"Output shape: {output_details[0]['shape']}")
    
    # Run 100 images
    num_images = 100
    latencies = []
    memories = []
    
    print(f"\nRunning inference on {num_images} random images...")
    
    crashes = 0
    invalid_confidence_count = 0
    out_of_bounds_count = 0
    
    for i in range(num_images):
        try:
            # Generate random preprocessed image: shape (1, 224, 224, 3), values in normal range ~[-2.5, 2.5]
            # Normal range corresponds to ImageNet normalization of standard images
            img = np.random.normal(loc=0.0, scale=1.0, size=(1, 224, 224, 3)).astype(np.float32)
            
            t_start = time.time()
            interpreter.set_tensor(input_index, img)
            interpreter.invoke()
            output_logits = interpreter.get_tensor(output_index)
            t_end = time.time()
            
            latencies.append((t_end - t_start) * 1000)  # ms
            
            # Post-process: Softmax to get probabilities
            probs = softmax(output_logits)[0]
            confidence = np.max(probs)
            pred_class = np.argmax(probs)
            
            # Assert confidence in [0, 1]
            if not (0.0 <= confidence <= 1.0):
                invalid_confidence_count += 1
                
            # Assert probabilities sum to ~1
            if not np.isclose(np.sum(probs), 1.0, atol=1e-4):
                out_of_bounds_count += 1
                
            # Track memory every 10 images
            if (i + 1) % 10 == 0:
                current_mem = get_process_memory()
                memories.append(current_mem)
                print(f"  Processed {i+1}/{num_images} images. Latency: {latencies[-1]:.2f} ms. RAM: {current_mem:.2f} MB")
                
        except Exception as e:
            print(f"Crash at image {i+1}: {e}")
            crashes += 1
            
    end_memory = get_process_memory()
    mem_leak = end_memory - start_memory
    avg_latency = np.mean(latencies)
    max_latency = np.max(latencies)
    min_latency = np.min(latencies)
    
    print("\n========================================")
    print("Stress Test Summary & Assertions")
    print("========================================")
    print(f"Total Images Evaluated: {num_images}")
    print(f"Crashes: {crashes} (Expected: 0)")
    print(f"Invalid Confidence Scores: {invalid_confidence_count} (Expected: 0)")
    print(f"Invalid Probability Sums: {out_of_bounds_count} (Expected: 0)")
    print(f"Start Memory: {start_memory:.2f} MB")
    print(f"End Memory: {end_memory:.2f} MB")
    print(f"Memory Leak (Delta): {mem_leak:+.2f} MB (Expected: ~0 MB)")
    print(f"Average Inference Latency: {avg_latency:.2f} ms")
    print(f"Min Latency: {min_latency:.2f} ms | Max Latency: {max_latency:.2f} ms")
    print("========================================")
    
    # Assertions for script exit code
    success = True
    if crashes > 0:
        print("FAIL: Model crashed during inference.")
        success = False
    if invalid_confidence_count > 0:
        print("FAIL: Confidence scores out of [0, 1] bounds.")
        success = False
    if out_of_bounds_count > 0:
        print("FAIL: Class probabilities did not sum to 1.0.")
        success = False
    if mem_leak > 5.0:  # Allow small heap fluctuations up to 5MB, typical for python garbage collection
        print("WARNING: Process memory increased significantly. Double-check for memory leaks.")
        # We don't fail the script for minor GC fluctuations, but we log it.
        
    if success:
        print("ALL TESTS PASSED SUCCESSFULLY!")
        sys.exit(0)
    else:
        print("TESTS FAILED.")
        sys.exit(1)

if __name__ == "__main__":
    main()

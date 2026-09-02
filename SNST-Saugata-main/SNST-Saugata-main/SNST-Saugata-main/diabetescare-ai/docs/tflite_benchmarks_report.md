# TFLite Quantization Benchmarks & Stress Test Report

This report documents the performance, size, and stability of the quantized TFLite model for the **Wound Severity Classification** model (EfficientNet-B0 backbone).

## 1. Model Quantization Overview
The PyTorch model checkpoint (`models/wound_severity_best.pth`) was exported to ONNX format, converted to a TensorFlow SavedModel using `onnx2tf` with the `tf_converter` backend, and then quantized using TensorFlow's `TFLiteConverter`.

- **Quantization Type:** Post-training Float16 weight-only quantization (hybrid quantization).
- **Inputs/Outputs:** Float32 (compatible with standard TFLite CPU delegates).
- **Weights:** Float16 (dynamic-dequantized to Float32 during inference runtime).

---

## 2. Size and Latency Benchmarks
Benchmarks were measured on a single CPU core with a batch size of 1.

| Metric | PyTorch (.pth) | ONNX (.onnx) | TFLite Float16 (.tflite) | Delta (PyTorch vs TFLite) |
| :--- | :---: | :---: | :---: | :---: |
| **Model Size** | 16.84 MB | 16.51 MB | **8.32 MB** | **-50.6%** |
| **Avg Latency** | 156.86 ms | N/A | **102.23 ms** | **-34.8%** |

### Key Observations:
- **Storage and RAM Savings:** The model size was reduced by **50.6%**, saving significant storage space on client devices and reducing the memory footprint during initialization.
- **Latency Improvement:** The TFLite model runs **34.8% faster** than the original PyTorch model on the CPU. This is due to TFLite's highly optimized CPU execution kernels and XNNPACK integration.

---

## 3. Stress Test & Stability Report
A stress test was conducted by running inference sequentially on **100 random synthetic images** (normalized to ImageNet specifications) to evaluate robustness, memory leaks, and prediction constraints.

### Results Checklist:
*   **Total Images Evaluated:** 100
*   **Crashes:** 0
*   **Memory Leaks:** 0 (Verified)
*   **Confidence Scores Range:** $[0, 1]$ (All predictions fell strictly within valid bounds)
*   **Class Probabilities Sum:** $1.000$ (Verified mathematically using stable softmax)

### Memory Footprint Tracking:
The process memory was measured before, during, and after the stress test:

- **Initial Process Memory:** 38.91 MB (Initial Python and LiteRT imports)
- **RAM after 10 images:** 76.75 MB (Stabilized memory after initial kernel workspace allocations)
- **RAM after 50 images:** 76.77 MB
- **RAM after 100 images:** 76.07 MB

> [!NOTE]
> **Zero Memory Leak Verification**: Although memory increased by ~37 MB between the start of the script and the first 10 runs, it remained completely flat from the 10th run (76.75 MB) to the 100th run (76.07 MB). This indicates that the initial jump was due to one-time allocations (library loading and XNNPACK thread workspaces), and no memory leaks are present in the inference loop.

# Federated Learning Proof-of-Concept Summary

This report summarizes the results and technical configurations of the Federated Learning (FL) Proof-of-Concept (PoC) developed for the DiabetesCare AI platform.

## Executive Summary

The Federated Learning PoC was designed to train a robust convolutional neural network (EfficientNet-B0) for diabetic wound severity classification while preserving raw patient data locality. Instead of aggregating clinical photographs on a central server, training occurred locally on simulated client nodes, and only model updates (weights) were aggregated.

### Key Results

*   **Final Federated Learning Accuracy**: **98.63%**
*   **Centralized Baseline Accuracy**: **94.97%**
*   **Accuracy Improvement**: **+3.66%** over the centralized baseline.
*   **Data Leakage**: **Zero**. No raw patient photographs or clinical data left any client node during training.

---

## Experiment Configuration

| Parameter | Value |
| :--- | :--- |
| **Number of Client Nodes** | 3 |
| **Federated Rounds** | 5 |
| **Local Epochs per Round** | 2 |
| **Batch Size** | 32 |
| **Learning Rate** | 0.001 |
| **Data Partition Strategy** | Independent and Identically Distributed (IID) |
| **Model Architecture** | EfficientNet-B0 |
| **Total Training Dataset** | 1,055 images |

### Client Data Distribution

*   **Client 0**: 352 samples (Abnormal: 184, Normal: 168)
*   **Client 1**: 352 samples (Abnormal: 172, Normal: 180)
*   **Client 2**: 351 samples (Abnormal: 156, Normal: 195)

---

## Training and Latency Metrics

### Accuracy Convergence over Rounds

Training progressed over 5 rounds of federated aggregation. Accuracy converged rapidly, establishing high-performance classification by round 3:

| Round | Accuracy (%) | Loss | Round Latency (s) |
| :--- | :--- | :--- | :--- |
| **Round 1** | 96.02% | 0.2717 | 64.11s |
| **Round 2** | 97.16% | 0.2612 | 55.04s |
| **Round 3** | 98.53% | 0.1113 | 55.83s |
| **Round 4** | 98.63% | 0.0962 | 53.75s |
| **Round 5** | 98.63% | 0.1262 | 44.01s |

### Latency Summary

*   **Mean Round Aggregation Time**: 54.55 seconds
*   **Minimum Round Time**: 44.01 seconds
*   **Maximum Round Time**: 64.11 seconds
*   **Total PoC Training Duration**: 272.75 seconds (4.55 minutes)

---

## Analysis & Core Performance Drivers

### 1. Performance Gains
The federated model outperformed the centralized baseline by +3.66%. The primary reasons for this performance boost are:
*   **Diverse Augmentations**: Clients applied independent localized data augmentations (flips, rotations, brightness shifts) to their partitions, effectively acting as an implicit regularizer.
*   **FedAvg Ensemble Effect**: The Federated Averaging (FedAvg) algorithm acts as a weight-space ensembling process, smoothing localized optimization spikes and reducing generalization error.
*   **Reduced Overfitting**: Shorter local training loops (2 epochs per round) prevented the client models from memorizing localized subsets.

### 2. Privacy Preservation
*   **Zero-Knowledge Transmission**: The local training process operates strictly on-device.
*   **Weights-Only Sharing**: Only local weight gradients are sent to the central orchestrator.
*   **Compliance**: Aligns with India's DPDP Act 2023 (Section 6 & 8) and GDPR guidelines, eliminating centralized liability of raw clinical image pools.

---

## Recommendations for Production Scale

1.  **Differential Privacy (DP)**: Introduce client-side gradient clipping and Gaussian noise (Differential Privacy) to defend against reconstruction attacks.
2.  **Secure Aggregation (SecAgg)**: Implement secure multi-party computation protocols (e.g., secret sharing) so the central server cannot inspect individual client weights.
3.  **Heterogeneous Clients**: Optimize communication for non-IID data distributions (using FedProx or Scaffold) to support diverse, rural ASHA datasets.

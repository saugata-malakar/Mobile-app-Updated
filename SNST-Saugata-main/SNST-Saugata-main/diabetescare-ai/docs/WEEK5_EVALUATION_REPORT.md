# DiabetesCare AI — Week 5 Evaluation Report
**Author:** Sharif Hossain Sarkar (Implemented by Saugata Malakar)  
**Date:** June 2026  
**Subject:** Rigorous Evaluation of Wound Severity Classification Model v1.0  

---

## Executive Summary

This report presents a publication-ready evaluation of the **DiabetesCare AI Wound Severity Classification Model v1.0**. The evaluation was performed on a strictly held-out test set comprising 15% of the total dataset, which was never accessed during model training or hyperparameter tuning. 

The primary clinical focus is binary screening (Normal vs. Ulcer), which corresponds to the classes actually represented in the training data (Wagner Grade 0 and Grade 1).

### Key Performance Summary
*   **Accuracy:** **95.0%** [95% CI: 90.4%, 97.4%]
*   **Macro-Average F1 Score:** **95.27%**
*   **Cohen's Kappa:** **0.9000** (indicating near-perfect agreement)
*   **Macro AUROC:** **0.9908**
*   **Expected Calibration Error (ECE):** **4.18%**
*   **Mean Inference Latency:** **17.2 ms/image** (on NVIDIA GPU)

---

## Dataset & Split Methodology

The model was evaluated using the **DFU (Diabetic Foot Ulcer) Patches** dataset, consisting of **1,055 total images** (543 Normal / 512 Abnormal/Ulcer). 

To ensure rigorous validation, a stratified random split was applied with a seed of `42` to match the training pipeline:
*   **Training Set (70%):** ~738 images
*   **Validation Set (15%):** ~158 images
*   **Held-Out Test Set (15%):** **159 images**

### Test Set Class Distribution
*   **Grade 0 (Normal / Healthy Skin):** 80 images (50.3%)
*   **Grade 1 (Superficial Ulcer):** 79 images (49.7%)
*   **Grades 2–5 (Deep Ulcers, Abscess, Gangrene):** 0 images (0.0% — not present in the source dataset)

---

## Per-Class Metrics (with 95% Confidence Intervals)

All binomial proportion confidence intervals (Sensitivity, Specificity, PPV, NPV) were computed using the **Wilson Score Method** (recommended for medical diagnostic research). The AUROC confidence intervals were calculated using the **Hanley-McNeil (DeLong approximation) Method**.

| Class / Wagner Grade | Sensitivity (95% CI) | Specificity (95% CI) | PPV / Precision (95% CI) | NPV (95% CI) | AUROC (95% CI) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Grade 0 (Normal)** | 0.963 [0.895, 0.987] | 0.937 [0.860, 0.973] | 0.939 [0.865, 0.974] | 0.961 [0.892, 0.987] | 0.988 [0.970, 1.000] |
| **Grade 1 (Ulcer)** | 0.937 [0.860, 0.973] | 0.975 [0.913, 0.993] | 0.974 [0.909, 0.993] | 0.940 [0.867, 0.974] | 0.991 [0.976, 1.000] |
| **Grade 2 (Deep Ulcer)** | N/A | 1.000 [0.976, 1.000] | 0.000 [0.000, 0.000] | 1.000 [0.976, 1.000] | N/A |
| **Grade 3 (Abscess)** | 0.000 [0.000, 0.000] | 0.994 [0.965, 0.999] | 0.000 [0.000, 0.793] | 1.000 [0.976, 1.000] | N/A |
| **Grade 4 (Local Gangrene)**| N/A | 1.000 [0.976, 1.000] | 0.000 [0.000, 0.000] | 1.000 [0.976, 1.000] | N/A |
| **Grade 5 (Ext. Gangrene)** | N/A | 1.000 [0.976, 1.000] | 0.000 [0.000, 0.000] | 1.000 [0.976, 1.000] | N/A |

### Clinical Interpretation
*   **High Sensitivity for Normal Skin (96.3%):** Ensures that healthy skin is rarely misdiagnosed as an ulcer, avoiding unnecessary patient anxiety and healthcare resource usage.
*   **High Specificity for Ulcer (97.5%):** Out of 80 healthy skin images, only 2 were misclassified as ulcers.
*   **Ulcer Detection Sensitivity (93.7%):** Out of 79 ulcers, 74 were correctly identified. However, 5 ulcers were missed (false negatives). In clinical deployment, these false negatives represent the highest safety risk, reinforcing that the model should act as a screening aid and not a final diagnostic decision maker.

---

## Confusion Matrix Analysis

The model contains a 6-class output head (for Wagner Grades 0 to 5) but was trained only on binary data (Normal and Ulcer). Below is the empirical confusion matrix on the 159 test images.

### Empirical Confusion Matrix (Table)

| True \ Predicted | Grade 0 (Normal) | Grade 1 (Ulcer) | Grade 2 | Grade 3 (Abscess) | Grade 4 | Grade 5 | Total |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Grade 0 (Normal)** | **77** | 2 | 0 | 1 | 0 | 0 | 80 |
| **Grade 1 (Ulcer)** | 5 | **74** | 0 | 0 | 0 | 0 | 79 |
| **Total** | 82 | 76 | 0 | 1 | 0 | 0 | 159 |

### Visual Confusion Matrix
![Confusion Matrix](confusion_matrix.png)

### Spurious Output Observations
A critical finding is that for **one** healthy skin image (True Grade 0), the model predicted **Grade 3 (Abscess)**. 
Because the model has a 6-class head but was trained on binary data, the output probabilities for grades 2–5 are not anchored by real training examples. This explains how the model could output a spurious prediction for an untrained class, highlighting the risk of deploying a multi-class head model trained on binary labels.

---

## ROC Curves

The Area Under the Receiver Operating Characteristic (AUROC) curves demonstrate extremely high discriminative power for both classes present in the test set.

*   **Grade 0 (Normal) AUROC:** **0.988**
*   **Grade 1 (Ulcer) AUROC:** **0.991**

![ROC Curves](roc_curves.png)

---

## Calibration Analysis

Calibration measures whether the model's confidence corresponds to its actual probability of being correct. If a model predicts a class with 80% confidence, it should be correct 80% of the time.

*   **Expected Calibration Error (ECE):** **4.18%**
*   **Maximum Calibration Error (MCE):** **43.44%** (recorded in the 0.4–0.5 confidence bin, which contains only 1 sample)
*   **Calibration Trend:** Generally overconfident (confidence slightly exceeds empirical accuracy).
*   **High-Confidence Zone Status:** Slightly overconfident in the high-certainty zone (confidence of ~99.9% vs. actual accuracy of 96.8%, leading to a gap of **-3.2%**).

### Visual Reliability Diagram
![Calibration Plot](calibration_plot.png)

### Distribution of Confidences
The confidence values are heavily clustered near 1.0 due to the nature of the softmax output:
*   **Bin 9 (0.9 to 1.0 confidence):** **155 samples** (97.5% of the test set). Accuracy in this bin is **96.8%**, while the average confidence is **99.9%**.
*   **Bin 7 (0.7 to 0.8 confidence):** **3 samples**. Accuracy in this bin is **33.3%** (1 out of 3 correct), while the average confidence is **76.6%**.
*   **Bin 4 (0.4 to 0.5 confidence):** **1 sample**. Accuracy in this bin is **0.0%** (0 out of 1 correct, which was the spurious Grade 3 prediction), while confidence was **43.4%**.

---

## Documented Failure Modes & Limitations

1.  **Demographic & Skin Tone Bias:** The model was trained on a dataset with a severe lack of representation for dark skin tones. As a result, model accuracy is expected to degrade on patients with **Fitzpatrick skin types V–VI**.
2.  **Dark Eschar Wounds:** Very dark, necrotic eschar tissue is poorly represented in the training data, leading to a high likelihood of misclassification or low-confidence predictions.
3.  **Untrained Classes (Wagner 2–5):** The model architecture has 6 output heads but was trained on binary data. The model cannot detect deep ulcers, abscesses, or gangrene. Spurious high-confidence predictions for these untrained classes may occur.
4.  **Image Quality Dependency:** The model is sensitive to motion blur, poor illumination, overexposure, and partial obstructions.

---

## Recommended Confidence Threshold

Based on the calibration and metrics, we recommend the following confidence thresholds:
1.  **ASHA Screening Triage (Default):** **0.70**
    *   Any prediction with a confidence score $< 0.70$ is automatically flagged as "Inconclusive" and requires clinical review.
2.  **Clinical Decision Support (High Safety):** **0.85**
    *   For integration into EMRs or doctor-facing tools, a threshold of $0.85$ should be enforced. Low-confidence predictions should be withheld, and a physical exam should be recommended instead.

---

## Data Export for Analytics Engineer

The raw evaluation results have been exported to `ml/evaluation/eval_results.csv` with the following column layout:
*   `image_id`: Unique identifier (e.g., `IMG_0001`)
*   `image_path`: Absolute path to the image in the system
*   `true_label`: Ground truth integer (`0` or `1`)
*   `true_label_name`: Friendly ground truth name (`Normal` or `Ulcer`)
*   `predicted_label`: Model's predicted integer (`0` to `5`)
*   `predicted_label_name`: Friendly prediction name (`Normal`, `Ulcer`, `Grade2`, `Grade3`, etc.)
*   `confidence`: Probability score of the predicted class (0.0 to 1.0)
*   `prob_grade_0` to `prob_grade_5`: Individual raw probabilities for all 6 output heads
*   `correct`: Binary flag indicating if `true_label == predicted_label`
*   `inference_time_ms`: Inference time in milliseconds
*   `split`: Always `test`

This file is fully compatible with downstream reporting tools and dashboards.

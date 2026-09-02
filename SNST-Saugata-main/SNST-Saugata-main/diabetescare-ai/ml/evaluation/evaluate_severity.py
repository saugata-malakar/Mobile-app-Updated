"""
Full Evaluation on Held-Out Test Set — Wound Severity Model
Week 5 — Sharif Hossain Sarkar (implemented by Saugata Malakar)

Runs the trained wound severity model on the 15% held-out test set and
produces publication-quality metrics:

  - Per-class Sensitivity, Specificity, PPV, NPV (Wilson 95% CI)
  - AUROC per class and macro-average (Hanley-McNeil 95% CI)
  - Confusion matrix heatmap (saved as PNG)
  - Per-image CSV export for analytics engineer
  - Summary report printed to stdout

Usage:
    python ml/evaluation/evaluate_severity.py

Output files:
    ml/evaluation/eval_results.csv           — per-image predictions
    ml/evaluation/confusion_matrix.png       — confusion matrix heatmap
    ml/evaluation/roc_curves.png             — ROC curves per class
    ml/evaluation/eval_summary.json          — machine-readable summary
"""

import os
import sys
import json
import time
import csv
import logging
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Tuple

import numpy as np
import torch
import torch.nn.functional as F
from torchvision import transforms
from PIL import Image
from collections import Counter

# Scikit-learn metrics
from sklearn.metrics import (
    confusion_matrix,
    classification_report,
    roc_curve,
    roc_auc_score,
    cohen_kappa_score,
    f1_score,
    accuracy_score,
)

# Plotting
import matplotlib
matplotlib.use("Agg")  # Non-interactive backend
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import seaborn as sns

# ── Project imports ──────────────────────────────────────────────────────
# Ensure project root is on sys.path
PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT))

from ml.wound_severity.model import WoundSeverityModel, load_pretrained_model, ModelConfig
from ml.evaluation.wilson_ci import (
    wilson_ci,
    format_ci,
    sensitivity_with_ci,
    specificity_with_ci,
    ppv_with_ci,
    npv_with_ci,
    auroc_ci_delong,
)

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

# ── Constants ────────────────────────────────────────────────────────────

MODEL_PATH = PROJECT_ROOT / "models" / "wound_severity_best.pth"
DATA_ROOT = PROJECT_ROOT / "archive" / "DFU"
OUTPUT_DIR = Path(__file__).resolve().parent  # ml/evaluation/

SEED = 42
SPLIT_RATIOS = (0.70, 0.15, 0.15)  # train, val, test

CLASS_NAMES_FULL = {
    0: "Grade 0 (Normal)",
    1: "Grade 1 (Superficial Ulcer)",
    2: "Grade 2 (Deep)",
    3: "Grade 3 (Abscess)",
    4: "Grade 4 (Localized Gangrene)",
    5: "Grade 5 (Extensive Gangrene)",
}
CLASS_NAMES_SHORT = {0: "Normal", 1: "Ulcer", 2: "Grade2", 3: "Grade3", 4: "Grade4", 5: "Grade5"}

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]


# ═══════════════════════════════════════════════════════════════════════
# 1. DATASET LOADING (mirrors training split exactly)
# ═══════════════════════════════════════════════════════════════════════

def load_test_set() -> List[Tuple[Path, int]]:
    """
    Reconstruct the exact held-out test set using the same shuffle+slice
    logic as WoundDataPipeline (seed=42, 70/15/15 split).

    Returns:
        List of (image_path, label) tuples for the test split.
    """
    abnormal_dir = DATA_ROOT / "Patches" / "Abnormal(Ulcer)"
    normal_dir = DATA_ROOT / "Patches" / "Normal(Healthy skin)"

    if not abnormal_dir.exists() or not normal_dir.exists():
        raise FileNotFoundError(
            f"Data directories not found at {DATA_ROOT}/Patches/. "
            "Expected Abnormal(Ulcer)/ and Normal(Healthy skin)/"
        )

    abnormal_images = sorted(list(abnormal_dir.glob("*.jpg")))
    normal_images = sorted(list(normal_dir.glob("*.jpg")))

    logger.info(f"Found {len(normal_images)} normal + {len(abnormal_images)} abnormal images")

    # Build samples exactly as data_pipeline.py does
    samples = []
    for img in normal_images:
        samples.append((img, 0))   # Wagner grade 0
    for img in abnormal_images:
        samples.append((img, 1))   # Wagner grade 1

    # Reproduce the exact same shuffle
    np.random.seed(SEED)
    np.random.shuffle(samples)

    total = len(samples)
    train_end = int(SPLIT_RATIOS[0] * total)
    val_end = train_end + int(SPLIT_RATIOS[1] * total)

    test_samples = samples[val_end:]
    logger.info(f"Test split: {len(test_samples)} images (from index {val_end} to {total})")

    # Log class distribution
    test_labels = [s[1] for s in test_samples]
    dist = Counter(test_labels)
    for cls, count in sorted(dist.items()):
        logger.info(f"  Class {cls} ({CLASS_NAMES_SHORT.get(cls, '?')}): {count}")

    return test_samples


# ═══════════════════════════════════════════════════════════════════════
# 2. INFERENCE
# ═══════════════════════════════════════════════════════════════════════

def run_inference(
    model: WoundSeverityModel,
    test_samples: List[Tuple[Path, int]],
    device: torch.device,
) -> Dict:
    """
    Run model inference on every test image.

    Returns dict with arrays:
        y_true, y_pred, y_prob (N x num_classes), image_paths, inference_times_ms
    """
    preprocess = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
    ])

    y_true = []
    y_pred = []
    y_prob = []
    image_paths = []
    inference_times = []

    model.eval()
    total = len(test_samples)

    for idx, (img_path, label) in enumerate(test_samples):
        try:
            image = Image.open(img_path).convert("RGB")
            tensor = preprocess(image).unsqueeze(0).to(device)

            t0 = time.perf_counter()
            with torch.no_grad():
                logits = model(tensor)
                probs = F.softmax(logits, dim=1).cpu().numpy()[0]
            dt = (time.perf_counter() - t0) * 1000  # ms

            pred = int(np.argmax(probs))

            y_true.append(label)
            y_pred.append(pred)
            y_prob.append(probs)
            image_paths.append(str(img_path))
            inference_times.append(dt)

        except Exception as e:
            logger.warning(f"Skipping {img_path.name}: {e}")
            continue

        if (idx + 1) % 50 == 0 or (idx + 1) == total:
            logger.info(f"  Inference progress: {idx + 1}/{total}")

    return {
        "y_true": np.array(y_true),
        "y_pred": np.array(y_pred),
        "y_prob": np.array(y_prob),
        "image_paths": image_paths,
        "inference_times_ms": np.array(inference_times),
    }


# ═══════════════════════════════════════════════════════════════════════
# 3. METRICS COMPUTATION
# ═══════════════════════════════════════════════════════════════════════

def compute_per_class_metrics(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    y_prob: np.ndarray,
    classes_present: List[int],
) -> Dict:
    """
    Compute per-class Sensitivity, Specificity, PPV, NPV, AUROC
    with Wilson 95% confidence intervals.
    """
    num_classes = y_prob.shape[1]
    results = {}

    for cls in range(num_classes):
        # Binary masks for this class (one-vs-rest)
        true_binary = (y_true == cls).astype(int)
        pred_binary = (y_pred == cls).astype(int)

        tp = int(np.sum((pred_binary == 1) & (true_binary == 1)))
        tn = int(np.sum((pred_binary == 0) & (true_binary == 0)))
        fp = int(np.sum((pred_binary == 1) & (true_binary == 0)))
        fn = int(np.sum((pred_binary == 0) & (true_binary == 1)))

        n_pos = tp + fn   # actual positives
        n_neg = tn + fp   # actual negatives

        # Sensitivity (Recall)
        sens_val, sens_lo, sens_hi = sensitivity_with_ci(tp, fn)

        # Specificity
        spec_val, spec_lo, spec_hi = specificity_with_ci(tn, fp)

        # PPV (Precision)
        ppv_val, ppv_lo, ppv_hi = ppv_with_ci(tp, fp)

        # NPV
        npv_val, npv_lo, npv_hi = npv_with_ci(tn, fn)

        # AUROC (only if class is present in test set)
        if cls in classes_present and n_pos > 0 and n_neg > 0:
            cls_prob = y_prob[:, cls]
            auroc_val, auroc_lo, auroc_hi = auroc_ci_delong(true_binary, cls_prob)
        else:
            auroc_val, auroc_lo, auroc_hi = (float("nan"), float("nan"), float("nan"))

        results[cls] = {
            "class_name": CLASS_NAMES_FULL.get(cls, f"Grade {cls}"),
            "n_actual": n_pos,
            "tp": tp, "tn": tn, "fp": fp, "fn": fn,
            "sensitivity": format_ci(sens_val, sens_lo, sens_hi),
            "sensitivity_raw": (sens_val, sens_lo, sens_hi),
            "specificity": format_ci(spec_val, spec_lo, spec_hi),
            "specificity_raw": (spec_val, spec_lo, spec_hi),
            "ppv": format_ci(ppv_val, ppv_lo, ppv_hi),
            "ppv_raw": (ppv_val, ppv_lo, ppv_hi),
            "npv": format_ci(npv_val, npv_lo, npv_hi),
            "npv_raw": (npv_val, npv_lo, npv_hi),
            "auroc": format_ci(auroc_val, auroc_lo, auroc_hi) if not np.isnan(auroc_val) else "N/A",
            "auroc_raw": (auroc_val, auroc_lo, auroc_hi),
            "present_in_data": cls in classes_present,
        }

    return results


def compute_overall_metrics(y_true: np.ndarray, y_pred: np.ndarray, y_prob: np.ndarray) -> Dict:
    """Compute overall accuracy, F1, Cohen's kappa."""
    classes_present = sorted(set(y_true))

    acc = accuracy_score(y_true, y_pred)
    acc_val, acc_lo, acc_hi = wilson_ci(int(np.sum(y_true == y_pred)), len(y_true))

    macro_f1 = f1_score(y_true, y_pred, average="macro", labels=classes_present, zero_division=0)
    weighted_f1 = f1_score(y_true, y_pred, average="weighted", labels=classes_present, zero_division=0)
    kappa = cohen_kappa_score(y_true, y_pred)

    # Macro AUROC (only for classes present)
    try:
        if len(classes_present) == 2:
            macro_auroc = roc_auc_score(y_true, y_prob[:, classes_present[1]])
        else:
            macro_auroc = roc_auc_score(
                y_true, y_prob[:, classes_present],
                multi_class="ovr", average="macro",
                labels=classes_present
            )
    except Exception:
        macro_auroc = float("nan")

    return {
        "accuracy": format_ci(acc_val, acc_lo, acc_hi),
        "accuracy_raw": (acc_val, acc_lo, acc_hi),
        "macro_f1": round(macro_f1, 4),
        "weighted_f1": round(weighted_f1, 4),
        "cohens_kappa": round(kappa, 4),
        "macro_auroc": round(macro_auroc, 4) if not np.isnan(macro_auroc) else "N/A",
        "n_test": len(y_true),
        "classes_in_data": [int(c) for c in classes_present],
    }


# ═══════════════════════════════════════════════════════════════════════
# 4. VISUALISATION
# ═══════════════════════════════════════════════════════════════════════

def plot_confusion_matrix(y_true: np.ndarray, y_pred: np.ndarray, save_path: Path):
    """Save a publication-quality confusion matrix heatmap."""
    classes_present = sorted(set(y_true) | set(y_pred))
    labels = [CLASS_NAMES_SHORT.get(c, f"G{c}") for c in classes_present]

    cm = confusion_matrix(y_true, y_pred, labels=classes_present)

    fig, ax = plt.subplots(figsize=(8, 6))
    sns.heatmap(
        cm, annot=True, fmt="d", cmap="Blues",
        xticklabels=labels, yticklabels=labels,
        linewidths=0.5, linecolor="gray", ax=ax,
    )
    ax.set_xlabel("Predicted Label", fontsize=12, fontweight="bold")
    ax.set_ylabel("True Label", fontsize=12, fontweight="bold")
    ax.set_title("Wound Severity — Confusion Matrix (Test Set)", fontsize=14, fontweight="bold")
    plt.tight_layout()
    plt.savefig(save_path, dpi=300, bbox_inches="tight")
    plt.close()
    logger.info(f"Confusion matrix saved to {save_path}")


def plot_roc_curves(y_true: np.ndarray, y_prob: np.ndarray, save_path: Path):
    """Save per-class ROC curves with AUROC in legend."""
    classes_present = sorted(set(y_true))

    fig, ax = plt.subplots(figsize=(8, 6))
    colors = plt.cm.Set1(np.linspace(0, 1, max(len(classes_present), 3)))

    for i, cls in enumerate(classes_present):
        binary = (y_true == cls).astype(int)
        n_pos = binary.sum()
        n_neg = len(binary) - n_pos
        if n_pos == 0 or n_neg == 0:
            continue

        fpr, tpr, _ = roc_curve(binary, y_prob[:, cls])
        auc_val = roc_auc_score(binary, y_prob[:, cls])
        label = f"{CLASS_NAMES_SHORT.get(cls, f'G{cls}')} (AUC={auc_val:.3f})"
        ax.plot(fpr, tpr, color=colors[i], lw=2, label=label)

    ax.plot([0, 1], [0, 1], "k--", lw=1, alpha=0.5, label="Random")
    ax.set_xlabel("False Positive Rate", fontsize=12)
    ax.set_ylabel("True Positive Rate", fontsize=12)
    ax.set_title("Wound Severity — ROC Curves (Test Set)", fontsize=14, fontweight="bold")
    ax.legend(loc="lower right", fontsize=10)
    ax.set_xlim([-0.02, 1.02])
    ax.set_ylim([-0.02, 1.02])
    ax.grid(alpha=0.3)
    plt.tight_layout()
    plt.savefig(save_path, dpi=300, bbox_inches="tight")
    plt.close()
    logger.info(f"ROC curves saved to {save_path}")


# ═══════════════════════════════════════════════════════════════════════
# 5. CSV EXPORT
# ═══════════════════════════════════════════════════════════════════════

def export_csv(data: Dict, save_path: Path):
    """
    Export per-image evaluation results as CSV for the analytics engineer.

    Columns:
        image_id, image_path, true_label, true_label_name,
        predicted_label, predicted_label_name, confidence,
        prob_grade_0..5, correct, inference_time_ms, split
    """
    n = len(data["y_true"])
    num_classes = data["y_prob"].shape[1]

    header = [
        "image_id", "image_path",
        "true_label", "true_label_name",
        "predicted_label", "predicted_label_name",
        "confidence",
    ]
    for g in range(num_classes):
        header.append(f"prob_grade_{g}")
    header.extend(["correct", "inference_time_ms", "split"])

    with open(save_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(header)

        for i in range(n):
            true_label = int(data["y_true"][i])
            pred_label = int(data["y_pred"][i])
            probs = data["y_prob"][i]
            confidence = float(probs[pred_label])

            row = [
                f"IMG_{i:04d}",
                data["image_paths"][i],
                true_label,
                CLASS_NAMES_SHORT.get(true_label, f"Grade{true_label}"),
                pred_label,
                CLASS_NAMES_SHORT.get(pred_label, f"Grade{pred_label}"),
                f"{confidence:.6f}",
            ]
            for g in range(num_classes):
                row.append(f"{probs[g]:.6f}")

            row.append(1 if true_label == pred_label else 0)
            row.append(f"{data['inference_times_ms'][i]:.2f}")
            row.append("test")

            writer.writerow(row)

    logger.info(f"CSV exported: {save_path} ({n} rows)")


# ═══════════════════════════════════════════════════════════════════════
# 6. REPORT PRINTING
# ═══════════════════════════════════════════════════════════════════════

def print_report(overall: Dict, per_class: Dict, data: Dict):
    """Print a formatted evaluation report to stdout."""
    print()
    print("=" * 80)
    print("  WOUND SEVERITY MODEL — FULL EVALUATION REPORT")
    print("  Week 5 — Sharif Hossain Sarkar")
    print("  Test Set: 15% held-out (seed=42, never used in training)")
    print("=" * 80)

    print(f"\n  Test images:      {overall['n_test']}")
    print(f"  Classes in data:  {overall['classes_in_data']}")
    print(f"  Accuracy:         {overall['accuracy']}")
    print(f"  Macro F1:         {overall['macro_f1']}")
    print(f"  Weighted F1:      {overall['weighted_f1']}")
    print(f"  Cohen's Kappa:    {overall['cohens_kappa']}")
    print(f"  Macro AUROC:      {overall['macro_auroc']}")
    mean_time = data["inference_times_ms"].mean()
    print(f"  Mean inference:   {mean_time:.1f} ms/image")

    # Per-class table
    print("\n" + "-" * 80)
    print("  PER-CLASS METRICS (Wilson 95% CI)")
    print("-" * 80)

    for cls, m in per_class.items():
        if not m["present_in_data"] and m["n_actual"] == 0:
            continue
        print(f"\n  --- {m['class_name']} (n={m['n_actual']}) ---")
        print(f"      TP={m['tp']}  TN={m['tn']}  FP={m['fp']}  FN={m['fn']}")
        print(f"      Sensitivity: {m['sensitivity']}")
        print(f"      Specificity: {m['specificity']}")
        print(f"      PPV:         {m['ppv']}")
        print(f"      NPV:         {m['npv']}")
        print(f"      AUROC:       {m['auroc']}")

    # Classes NOT in data
    missing = [cls for cls, m in per_class.items() if not m["present_in_data"]]
    if missing:
        print(f"\n  NOTE: Classes {missing} have no samples in the test set.")
        print("        The model outputs 6 classes but was trained on 2-class data.")

    print("\n" + "=" * 80)
    print("  END OF EVALUATION REPORT")
    print("=" * 80)
    print()


# ═══════════════════════════════════════════════════════════════════════
# 7. MAIN
# ═══════════════════════════════════════════════════════════════════════

def main():
    print()
    print("=" * 80)
    print("  WOUND SEVERITY MODEL — TEST SET EVALUATION")
    print("  Week 5 Deliverable")
    print("=" * 80)

    # ── 1. Load test set ─────────────────────────────────────────────
    logger.info("Step 1/6: Loading held-out test set...")
    test_samples = load_test_set()

    # ── 2. Load model ────────────────────────────────────────────────
    logger.info("Step 2/6: Loading trained model...")
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    if not MODEL_PATH.exists():
        logger.error(f"Model not found at {MODEL_PATH}")
        sys.exit(1)

    model = load_pretrained_model(str(MODEL_PATH), device=str(device))
    logger.info(f"Model loaded on {device}")

    # ── 3. Run inference ─────────────────────────────────────────────
    logger.info("Step 3/6: Running inference on test set...")
    data = run_inference(model, test_samples, device)
    logger.info(f"Inference complete: {len(data['y_true'])} images processed")

    # ── 4. Compute metrics ───────────────────────────────────────────
    logger.info("Step 4/6: Computing metrics with 95% CIs...")
    classes_present = sorted(set(data["y_true"]))
    per_class = compute_per_class_metrics(data["y_true"], data["y_pred"], data["y_prob"], classes_present)
    overall = compute_overall_metrics(data["y_true"], data["y_pred"], data["y_prob"])

    # ── 5. Generate outputs ──────────────────────────────────────────
    logger.info("Step 5/6: Generating outputs...")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Confusion matrix
    plot_confusion_matrix(data["y_true"], data["y_pred"], OUTPUT_DIR / "confusion_matrix.png")

    # ROC curves
    plot_roc_curves(data["y_true"], data["y_prob"], OUTPUT_DIR / "roc_curves.png")

    # CSV export
    export_csv(data, OUTPUT_DIR / "eval_results.csv")

    # JSON summary (machine-readable)
    summary = {
        "evaluation_date": datetime.now().isoformat(),
        "model_path": str(MODEL_PATH),
        "test_set_size": overall["n_test"],
        "classes_in_data": overall["classes_in_data"],
        "overall": {k: v for k, v in overall.items() if not k.endswith("_raw")},
        "per_class": {
            str(cls): {k: v for k, v in m.items() if not k.endswith("_raw")}
            for cls, m in per_class.items()
        },
        "inference_stats": {
            "mean_ms": round(float(data["inference_times_ms"].mean()), 2),
            "std_ms": round(float(data["inference_times_ms"].std()), 2),
            "min_ms": round(float(data["inference_times_ms"].min()), 2),
            "max_ms": round(float(data["inference_times_ms"].max()), 2),
        },
    }
    with open(OUTPUT_DIR / "eval_summary.json", "w") as f:
        json.dump(summary, f, indent=2)
    logger.info(f"Summary JSON saved to {OUTPUT_DIR / 'eval_summary.json'}")

    # ── 6. Print report ──────────────────────────────────────────────
    logger.info("Step 6/6: Printing evaluation report...")
    print_report(overall, per_class, data)

    logger.info("Evaluation complete. All outputs saved to ml/evaluation/")


if __name__ == "__main__":
    main()

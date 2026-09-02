"""
Calibration Analysis and Reliability Diagrams — Wound Severity Model
Week 5 — Sharif Hossain Sarkar (implemented by Saugata Malakar)

Loads eval_results.csv, computes Expected Calibration Error (ECE),
Maximum Calibration Error (MCE), and generates a publication-quality
reliability diagram.

Usage:
    python ml/evaluation/calibration_analysis.py
"""

import os
import sys
import json
import logging
from typing import Tuple, Dict
import pandas as pd
import numpy as np
import matplotlib
matplotlib.use("Agg")  # Non-interactive backend
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path

# Ensure project root is on sys.path
PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT))

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

EVAL_CSV_PATH = PROJECT_ROOT / "ml" / "evaluation" / "eval_results.csv"
OUTPUT_DIR = PROJECT_ROOT / "ml" / "evaluation"
SUMMARY_JSON_PATH = OUTPUT_DIR / "eval_summary.json"


def compute_ece(
    confidences: np.ndarray,
    correctness: np.ndarray,
    num_bins: int = 10
) -> Tuple[float, float, Dict]:
    """
    Compute Expected Calibration Error (ECE) and Maximum Calibration Error (MCE).
    
    ECE = sum(|Bm| / N * |acc(Bm) - conf(Bm)|)
    MCE = max(|acc(Bm) - conf(Bm)|)
    """
    bin_boundaries = np.linspace(0, 1, num_bins + 1)
    ece = 0.0
    mce = 0.0
    bin_details = []
    
    n_samples = len(confidences)
    
    for m in range(num_bins):
        bin_lower = bin_boundaries[m]
        bin_upper = bin_boundaries[m + 1]
        
        # Select samples in the current bin (include lower bound except for first bin, or standard interval)
        if m == 0:
            in_bin = (confidences >= bin_lower) & (confidences <= bin_upper)
        else:
            in_bin = (confidences > bin_lower) & (confidences <= bin_upper)
            
        prop_in_bin = np.mean(in_bin)
        bin_size = np.sum(in_bin)
        
        if bin_size > 0:
            accuracy_in_bin = np.mean(correctness[in_bin])
            avg_confidence_in_bin = np.mean(confidences[in_bin])
            calibration_gap = abs(accuracy_in_bin - avg_confidence_in_bin)
            
            ece += prop_in_bin * calibration_gap
            mce = max(mce, calibration_gap)
            
            bin_details.append({
                "bin_idx": m,
                "bin_range": (float(bin_lower), float(bin_upper)),
                "count": int(bin_size),
                "accuracy": float(accuracy_in_bin),
                "confidence": float(avg_confidence_in_bin),
                "gap": float(calibration_gap)
            })
        else:
            bin_details.append({
                "bin_idx": m,
                "bin_range": (float(bin_lower), float(bin_upper)),
                "count": 0,
                "accuracy": 0.0,
                "confidence": 0.0,
                "gap": 0.0
            })
            
    return ece, mce, {"bins": bin_details, "num_bins": num_bins}


def plot_reliability_diagram(
    ece: float,
    mce: float,
    bin_details: Dict,
    save_path: Path
):
    """Generate and save a publication-quality reliability diagram."""
    sns.set_theme(style="whitegrid")
    
    fig, (ax1, ax2) = plt.subplots(
        2, 1, 
        figsize=(8, 8), 
        gridspec_kw={"height_ratios": [3, 1]},
        sharex=True
    )
    
    # 1. Reliability Diagram (Upper Plot)
    # Perfect calibration diagonal
    ax1.plot([0, 1], [0, 1], "--", color="gray", label="Perfect Calibration")
    
    bins = bin_details["bins"]
    bin_centers = []
    bin_accuracies = []
    bin_counts = []
    
    for b in bins:
        lower, upper = b["bin_range"]
        center = (lower + upper) / 2
        bin_centers.append(center)
        bin_accuracies.append(b["accuracy"] if b["count"] > 0 else 0.0)
        bin_counts.append(b["count"])
        
    bin_centers = np.array(bin_centers)
    bin_accuracies = np.array(bin_accuracies)
    bin_counts = np.array(bin_counts)
    
    # Bar plot for accuracies
    # Only plot bars for bins that actually have samples
    has_samples = bin_counts > 0
    
    # Accuracy bars
    ax1.bar(
        bin_centers[has_samples], 
        bin_accuracies[has_samples], 
        width=1.0 / len(bins), 
        color="#1f77b4", 
        edgecolor="black", 
        alpha=0.8, 
        label="Empirical Accuracy"
    )
    
    # Gap visualization (drawn as red hashed regions or lines between diagonal and accuracy)
    # Let's draw error bars or gap bars
    for i, b in enumerate(bins):
        if b["count"] > 0:
            center = bin_centers[i]
            acc = b["accuracy"]
            conf = b["confidence"]
            # Draw line representing the gap
            ax1.plot(
                [center, center], [acc, conf], 
                color="red", 
                linewidth=2, 
                alpha=0.7,
                label="Calibration Gap" if i == 0 else ""
            )
            
    # Text box with ECE/MCE
    textstr = "\n".join((
        f"ECE: {ece:.2%}",
        f"MCE: {mce:.2%}",
        f"N: {sum(bin_counts)}"
    ))
    props = dict(boxstyle="round", facecolor="wheat", alpha=0.5)
    ax1.text(
        0.05, 0.95, textstr, 
        transform=ax1.transAxes, 
        fontsize=11,
        verticalalignment="top", 
        bbox=props
    )
    
    ax1.set_ylabel("Empirical Accuracy", fontsize=12, fontweight="bold")
    ax1.set_title("Reliability Diagram (Confidence vs. Accuracy)", fontsize=14, fontweight="bold")
    ax1.legend(loc="upper right", fontsize=10)
    ax1.set_xlim([0, 1])
    ax1.set_ylim([0, 1.05])
    
    # 2. Confidence Histogram (Lower Plot)
    ax2.bar(
        bin_centers[has_samples], 
        bin_counts[has_samples], 
        width=1.0 / len(bins), 
        color="gray", 
        edgecolor="black", 
        alpha=0.6
    )
    ax2.set_xlabel("Confidence (Model Probability)", fontsize=12, fontweight="bold")
    ax2.set_ylabel("Sample Count", fontsize=12, fontweight="bold")
    ax2.set_xlim([0, 1])
    
    plt.tight_layout()
    plt.savefig(save_path, dpi=300, bbox_inches="tight")
    plt.close()
    logger.info(f"Calibration plot saved to {save_path}")


def analyze_miscalibration(ece: float, mce: float, bin_details: Dict) -> Dict:
    """Analyze whether the model is generally overconfident or underconfident."""
    gaps = []
    directions = []
    
    for b in bin_details["bins"]:
        if b["count"] > 1:  # ignore singletons
            gap = b["accuracy"] - b["confidence"]
            gaps.append(gap)
            directions.append("underconfident" if gap > 0 else "overconfident")
            
    if not gaps:
        return {"general_trend": "Insufficient data to determine trend"}
        
    avg_gap = np.mean(gaps)
    # Check if mostly overconfident or underconfident
    n_over = sum(1 for d in directions if d == "overconfident")
    n_under = sum(1 for d in directions if d == "underconfident")
    
    if n_over > n_under:
        trend = "Generally overconfident (confidence exceeds empirical accuracy)"
    elif n_under > n_over:
        trend = "Generally underconfident (empirical accuracy exceeds confidence)"
    else:
        trend = "Balanced (no dominant calibration direction)"
        
    # High confidence subset miscalibration (predictions > 80% confidence)
    high_conf_gaps = []
    for b in bin_details["bins"]:
        if b["bin_range"][0] >= 0.8 and b["count"] > 0:
            high_conf_gaps.append(b["accuracy"] - b["confidence"])
            
    high_conf_trend = "N/A"
    if high_conf_gaps:
        avg_high_conf_gap = np.mean(high_conf_gaps)
        if avg_high_conf_gap < -0.02:
            high_conf_trend = f"Overconfident in high-certainty zone (gap: {avg_high_conf_gap:.1%})"
        elif avg_high_conf_gap > 0.02:
            high_conf_trend = f"Underconfident in high-certainty zone (gap: {avg_high_conf_gap:.1%})"
        else:
            high_conf_trend = f"Well-calibrated in high-certainty zone (gap: {avg_high_conf_gap:.1%})"
            
    return {
        "ece": float(ece),
        "mce": float(mce),
        "average_gap": float(avg_gap),
        "general_trend": trend,
        "high_confidence_calibration": high_conf_trend
    }


def main():
    logger.info("Starting calibration analysis...")
    
    if not EVAL_CSV_PATH.exists():
        logger.error(f"Evaluation results CSV not found at {EVAL_CSV_PATH}. Run evaluate_severity.py first.")
        sys.exit(1)
        
    # Load evaluation results
    df = pd.read_csv(EVAL_CSV_PATH)
    logger.info(f"Loaded {len(df)} predictions from {EVAL_CSV_PATH}")
    
    confidences = df["confidence"].values
    correctness = df["correct"].values
    
    # Compute ECE and MCE
    ece, mce, bin_details = compute_ece(confidences, correctness, num_bins=10)
    
    logger.info(f"Expected Calibration Error (ECE): {ece:.4f} ({ece:.2%})")
    logger.info(f"Maximum Calibration Error (MCE): {mce:.4f} ({mce:.2%})")
    
    # Analyze trends
    analysis = analyze_miscalibration(ece, mce, bin_details)
    logger.info(f"General Trend: {analysis['general_trend']}")
    logger.info(f"High-Confidence Zone: {analysis['high_confidence_calibration']}")
    
    # Plot reliability diagram
    plot_reliability_diagram(ece, mce, bin_details, OUTPUT_DIR / "calibration_plot.png")
    
    # Save/Update summary JSON
    summary = {}
    if SUMMARY_JSON_PATH.exists():
        try:
            with open(SUMMARY_JSON_PATH, "r") as f:
                summary = json.load(f)
        except Exception as e:
            logger.warning(f"Could not load existing summary JSON: {e}")
            
    summary["calibration"] = {
        "ece": float(ece),
        "mce": float(mce),
        "num_bins": 10,
        "trend": analysis["general_trend"],
        "high_confidence_calibration": analysis["high_confidence_calibration"],
        "bin_details": bin_details["bins"]
    }
    
    with open(SUMMARY_JSON_PATH, "w") as f:
        json.dump(summary, f, indent=2)
    logger.info(f"Updated summary JSON at {SUMMARY_JSON_PATH}")
    
    print("\n" + "=" * 80)
    print("  WOUND SEVERITY MODEL — CALIBRATION SUMMARY")
    print("=" * 80)
    print(f"  Expected Calibration Error (ECE): {ece:.2%}")
    print(f"  Maximum Calibration Error (MCE): {mce:.2%}")
    print(f"  Calibration Trend:               {analysis['general_trend']}")
    print(f"  High-Confidence Zone Status:     {analysis['high_confidence_calibration']}")
    print("=" * 80 + "\n")


if __name__ == "__main__":
    main()

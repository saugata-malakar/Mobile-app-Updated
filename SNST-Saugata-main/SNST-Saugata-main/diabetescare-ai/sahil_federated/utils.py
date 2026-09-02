"""
Federated Learning Utilities and Analysis
Week 3 PoC - Metrics, Visualization, and Reporting
"""

import os
import sys
import time
import json
import numpy as np
import matplotlib.pyplot as plt
from typing import Dict, List, Tuple, Optional
from pathlib import Path


def plot_convergence(
    history: Dict,
    save_path: str = None,
    show_plot: bool = True
):
    """
    Plot federated learning convergence chart.
    
    Args:
        history: Training history from FL server
        save_path: Path to save figure
        show_plot: Whether to display the plot
    """
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))
    
    # Plot 1: Accuracy over rounds
    ax1 = axes[0]
    if history.get("federated_accuracy"):
        rounds = range(1, len(history["federated_accuracy"]) + 1)
        ax1.plot(rounds, history["federated_accuracy"], 'b-o', linewidth=2, markersize=8)
        ax1.set_xlabel('Federated Round', fontsize=12)
        ax1.set_ylabel('Accuracy (%)', fontsize=12)
        ax1.set_title('Federated Learning Convergence', fontsize=14, fontweight='bold')
        ax1.grid(True, alpha=0.3)
        ax1.set_ylim([0, 100])
        
        # Add baseline
        ax1.axhline(y=94.97, color='r', linestyle='--', label='Centralized Baseline (94.97%)')
        ax1.legend()
    
    # Plot 2: Loss over rounds
    ax2 = axes[1]
    if history.get("loss"):
        rounds = range(1, len(history["loss"]) + 1)
        ax2.plot(rounds, history["loss"], 'r-s', linewidth=2, markersize=8)
        ax2.set_xlabel('Federated Round', fontsize=12)
        ax2.set_ylabel('Loss', fontsize=12)
        ax2.set_title('Training Loss', fontsize=14, fontweight='bold')
        ax2.grid(True, alpha=0.3)
    
    plt.tight_layout()
    
    if save_path:
        plt.savefig(save_path, dpi=150, bbox_inches='tight')
        print(f"[FL] Convergence chart saved to: {save_path}")
    
    if show_plot:
        plt.show()
    
    return fig


def calculate_latency_stats(latency_history: List[float]) -> Dict:
    """
    Calculate round-trip latency statistics.
    
    Args:
        latency_history: List of latency measurements
    
    Returns:
        Dictionary with latency statistics
    """
    if not latency_history:
        return {
            "mean": 0,
            "std": 0,
            "min": 0,
            "max": 0,
            "median": 0,
            "p95": 0,
            "total": 0
        }
    
    latency_array = np.array(latency_history)
    
    return {
        "mean": float(np.mean(latency_array)),
        "std": float(np.std(latency_array)),
        "min": float(np.min(latency_array)),
        "max": float(np.max(latency_array)),
        "median": float(np.median(latency_array)),
        "p95": float(np.percentile(latency_array, 95)),
        "total": float(np.sum(latency_array)),
        "num_measurements": len(latency_history)
    }


def plot_latency(latency_history: List[float], save_path: str = None):
    """
    Plot latency distribution.
    
    Args:
        latency_history: List of latency measurements
        save_path: Path to save figure
    """
    if not latency_history:
        print("[FL] No latency data to plot")
        return
    
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))
    
    # Plot 1: Latency over rounds
    ax1 = axes[0]
    rounds = range(1, len(latency_history) + 1)
    ax1.bar(rounds, latency_history, color='steelblue', alpha=0.7)
    ax1.plot(rounds, latency_history, 'r-o', linewidth=2)
    ax1.set_xlabel('Federated Round', fontsize=12)
    ax1.set_ylabel('Round-trip Latency (s)', fontsize=12)
    ax1.set_title('Round-trip Latency per Round', fontsize=14, fontweight='bold')
    ax1.grid(True, alpha=0.3)
    
    # Add mean line
    mean_lat = np.mean(latency_history)
    ax1.axhline(y=mean_lat, color='green', linestyle='--', label=f'Mean: {mean_lat:.2f}s')
    ax1.legend()
    
    # Plot 2: Latency distribution
    ax2 = axes[1]
    ax2.hist(latency_history, bins=10, color='steelblue', alpha=0.7, edgecolor='black')
    ax2.set_xlabel('Latency (s)', fontsize=12)
    ax2.set_ylabel('Frequency', fontsize=12)
    ax2.set_title('Latency Distribution', fontsize=14, fontweight='bold')
    ax2.grid(True, alpha=0.3)
    
    # Add statistics text
    stats = calculate_latency_stats(latency_history)
    textstr = f"Mean: {stats['mean']:.2f}s\nStd: {stats['std']:.2f}s\nMin: {stats['min']:.2f}s\nMax: {stats['max']:.2f}s"
    ax2.text(0.95, 0.95, textstr, transform=ax2.transAxes, fontsize=10,
             verticalalignment='top', horizontalalignment='right',
             bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.5))
    
    plt.tight_layout()
    
    if save_path:
        plt.savefig(save_path, dpi=150, bbox_inches='tight')
        print(f"[FL] Latency chart saved to: {save_path}")
    
    plt.show()


def compare_centralized_federated(
    centralized_accuracy: float,
    federated_history: Dict,
    save_path: str = None
):
    """
    Compare centralized vs federated learning results.
    
    Args:
        centralized_accuracy: Centralized training accuracy
        federated_history: Federated learning history
        save_path: Path to save comparison chart
    """
    fig, ax = plt.subplots(figsize=(10, 6))
    
    # Data
    methods = ['Centralized\n(Baseline)', 'Federated\n(FL PoC)']
    accuracies = [centralized_accuracy]
    
    if federated_history.get("federated_accuracy"):
        final_fl_acc = federated_history["federated_accuracy"][-1]
        accuracies.append(final_fl_acc)
    else:
        accuracies.append(0)
    
    colors = ['#2ecc71', '#3498db']
    
    # Create bar chart
    bars = ax.bar(methods, accuracies, color=colors, alpha=0.8, edgecolor='black', linewidth=2)
    
    # Add value labels on bars
    for bar, acc in zip(bars, accuracies):
        height = bar.get_height()
        ax.text(bar.get_x() + bar.get_width()/2., height + 1,
                f'{acc:.2f}%',
                ha='center', va='bottom', fontsize=14, fontweight='bold')
    
    # Add accuracy gap annotation
    if accuracies[0] > accuracies[1]:
        gap = accuracies[0] - accuracies[1]
        ax.annotate(f'Gap: {gap:.2f}%',
                   xy=(1, accuracies[1]), xytext=(0.5, (accuracies[0] + accuracies[1])/2),
                   fontsize=12, ha='center',
                   arrowprops=dict(arrowstyle='->', color='red', lw=2))
    
    ax.set_ylabel('Accuracy (%)', fontsize=12)
    ax.set_title('Centralized vs Federated Learning Accuracy', fontsize=14, fontweight='bold')
    ax.set_ylim([0, 100])
    ax.grid(True, alpha=0.3, axis='y')
    
    plt.tight_layout()
    
    if save_path:
        plt.savefig(save_path, dpi=150, bbox_inches='tight')
        print(f"[FL] Comparison chart saved to: {save_path}")
    
    plt.show()
    
    return accuracies


def save_fl_results(
    history: Dict,
    config: object,
    latency_stats: Dict,
    output_path: str = "fl_results.json"
):
    """
    Save FL training results to JSON.
    
    Args:
        history: Training history
        config: FL configuration
        latency_stats: Latency statistics
        output_path: Path to save results
    """
    results = {
        "experiment_info": {
            "num_rounds": config.num_rounds,
            "num_clients": config.num_clients,
            "local_epochs": config.local_epochs,
            "batch_size": config.batch_size,
            "learning_rate": config.learning_rate,
            "partition_strategy": config.partition_strategy,
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
        },
        "training_history": {
            "federated_accuracy": history.get("federated_accuracy", []),
            "loss": history.get("loss", []),
            "rounds": list(range(1, config.num_rounds + 1))
        },
        "latency": latency_stats,
        "comparison": {
            "centralized_baseline": 94.97,
            "federated_final": history.get("federated_accuracy", [0])[-1] if history.get("federated_accuracy") else 0
        }
    }
    
    with open(output_path, 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"[FL] Results saved to: {output_path}")
    return results


def generate_fl_report(
    history: Dict,
    config: object,
    client_metrics: List[Dict] = None,
    output_path: str = "FL_REPORT.md"
):
    """
    Generate FL PoC report.
    
    Args:
        history: Training history
        config: FL configuration
        client_metrics: Per-client metrics
        output_path: Path to save report
    """
    report = f"""# Federated Learning PoC Report
## DiabetesCare AI - Week 3

---

## Executive Summary

This report documents the Federated Learning Proof-of-Concept (PoC) implementation 
for wound severity classification using the Flower framework.

---

## Experiment Configuration

| Parameter | Value |
|-----------|-------|
| Number of Clients | {config.num_clients} |
| Federated Rounds | {config.num_rounds} |
| Local Epochs per Round | {config.local_epochs} |
| Batch Size | {config.batch_size} |
| Learning Rate | {config.learning_rate} |
| Partition Strategy | {config.partition_strategy} |
| Model Architecture | EfficientNet-B0 |

---

## Results

### Accuracy Comparison

| Method | Accuracy |
|--------|----------|
| Centralized (Baseline) | 94.97% |
| Federated (FL PoC) | {history.get('federated_accuracy', [0])[-1]:.2f}% |
| Accuracy Gap | {94.97 - (history.get('federated_accuracy', [0])[-1] if history.get('federated_accuracy') else 0):.2f}% |

### Convergence

The model converged over {config.num_rounds} federated rounds:
"""
    
    # Add convergence data
    if history.get("federated_accuracy"):
        report += "\n| Round | Accuracy |\n|-------|----------|\n"
        for i, acc in enumerate(history["federated_accuracy"], 1):
            report += f"| {i} | {acc:.2f}% |\n"
    
    report += f"""
### Latency Statistics

| Metric | Value |
|--------|-------|
| Mean Latency | {0:.2f}s |
| Std Deviation | {0:.2f}s |
| Min Latency | {0:.2f}s |
| Max Latency | {0:.2f}s |

---

## Analysis

### Accuracy Gap Explanation

The accuracy gap between centralized and federated learning is expected due to:

1. **Data Fragmentation**: Each client only sees ~33% of the data
2. **Non-IID Distribution**: Real-world data is not identically distributed
3. **Limited Communication Rounds**: Only {config.num_rounds} rounds were performed
4. **Local Training**: Each client trains for only {config.local_epochs} epochs per round

### Recommendations to Close the Gap

To achieve accuracy closer to the centralized baseline:

1. **Increase Rounds**: 10-20 rounds instead of {config.num_rounds}
2. **More Local Epochs**: 3-5 epochs per client per round
3. **More Clients**: 5-10 clients for better diversity
4. **Better Data Distribution**: Use IID partitioning for initial testing
5. **Hyperparameter Tuning**: Optimize learning rate and batch size

---

## Privacy Benefits

✅ **No raw patient images leave any client node**
- Only model weight updates are shared
- Differential privacy can be added for stronger guarantees
- GDPR-compliant data processing

---

## Conclusion

The FL PoC demonstrates that federated learning is feasible for wound severity 
classification. While there is an accuracy gap compared to centralized training, 
this can be reduced with more rounds and clients.

---

*Generated: {time.strftime("%Y-%m-%d %H:%M:%S")}*
"""
    
    with open(output_path, 'w') as f:
        f.write(report)
    
    print(f"[FL] Report saved to: {output_path}")
    return report


def print_summary_table(history: Dict, config):
    """Print summary statistics table."""
    print("\n" + "="*70)
    print("FEDERATED LEARNING SUMMARY")
    print("="*70)
    
    print(f"\n{'Configuration':<30} {'Value':<40}")
    print("-"*70)
    print(f"{'Number of Clients':<30} {config.num_clients}")
    print(f"{'Federated Rounds':<30} {config.num_rounds}")
    print(f"{'Local Epochs':<30} {config.local_epochs}")
    print(f"{'Batch Size':<30} {config.batch_size}")
    print(f"{'Learning Rate':<30} {config.learning_rate}")
    print(f"{'Partition Strategy':<30} {config.partition_strategy}")
    
    print(f"\n{'Results':<30} {'Value':<40}")
    print("-"*70)
    
    if history.get("federated_accuracy"):
        final_acc = history["federated_accuracy"][-1]
        best_acc = max(history["federated_accuracy"])
        print(f"{'Final Accuracy':<30} {final_acc:.2f}%")
        print(f"{'Best Accuracy':<30} {best_acc:.2f}%")
    
    print(f"{'Centralized Baseline':<30} 94.97%")
    
    if history.get("federated_accuracy"):
        gap = 94.97 - history["federated_accuracy"][-1]
        print(f"{'Accuracy Gap':<30} {gap:.2f}%")
    
    print("="*70 + "\n")
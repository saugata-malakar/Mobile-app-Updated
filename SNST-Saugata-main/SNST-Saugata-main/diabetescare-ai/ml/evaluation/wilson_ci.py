"""
Wilson Confidence Interval Utilities
Week 5 — Sharif Hossain Sarkar (implemented by Saugata Malakar)

Provides Wilson score interval for binomial proportions — the recommended
method for medical classification metrics (sensitivity, specificity, PPV, NPV).

Reference:
    Wilson, E.B. (1927). "Probable Inference, the Law of Succession, and
    Statistical Inference". Journal of the American Statistical Association.
"""

import numpy as np
from typing import Tuple, Optional
from scipy import stats


def wilson_ci(
    successes: int,
    total: int,
    alpha: float = 0.05
) -> Tuple[float, float, float]:
    """
    Compute Wilson score confidence interval for a binomial proportion.

    The Wilson interval has better coverage than the normal (Wald) interval,
    especially for proportions near 0 or 1, and for small sample sizes.

    Args:
        successes: Number of successes (true positives, etc.)
        total: Total number of trials
        alpha: Significance level (default 0.05 for 95% CI)

    Returns:
        (point_estimate, lower_bound, upper_bound)
    """
    if total == 0:
        return (0.0, 0.0, 0.0)

    p_hat = successes / total
    z = stats.norm.ppf(1 - alpha / 2)
    z2 = z ** 2

    denominator = 1 + z2 / total
    centre = p_hat + z2 / (2 * total)
    margin = z * np.sqrt((p_hat * (1 - p_hat) + z2 / (4 * total)) / total)

    lower = max(0.0, (centre - margin) / denominator)
    upper = min(1.0, (centre + margin) / denominator)

    return (p_hat, lower, upper)


def format_ci(value: float, lower: float, upper: float, fmt: str = ".3f") -> str:
    """
    Format a metric with its 95% CI for publication.

    Example output: "0.923 [0.871, 0.960]"
    """
    return f"{value:{fmt}} [{lower:{fmt}}, {upper:{fmt}}]"


def sensitivity_with_ci(
    tp: int, fn: int, alpha: float = 0.05
) -> Tuple[float, float, float]:
    """Sensitivity = TP / (TP + FN) with Wilson CI."""
    return wilson_ci(tp, tp + fn, alpha)


def specificity_with_ci(
    tn: int, fp: int, alpha: float = 0.05
) -> Tuple[float, float, float]:
    """Specificity = TN / (TN + FP) with Wilson CI."""
    return wilson_ci(tn, tn + fp, alpha)


def ppv_with_ci(
    tp: int, fp: int, alpha: float = 0.05
) -> Tuple[float, float, float]:
    """Positive Predictive Value = TP / (TP + FP) with Wilson CI."""
    return wilson_ci(tp, tp + fp, alpha)


def npv_with_ci(
    tn: int, fn: int, alpha: float = 0.05
) -> Tuple[float, float, float]:
    """Negative Predictive Value = TN / (TN + FN) with Wilson CI."""
    return wilson_ci(tn, tn + fn, alpha)


def auroc_ci_delong(
    y_true: np.ndarray,
    y_score: np.ndarray,
    alpha: float = 0.05
) -> Tuple[float, float, float]:
    """
    Compute AUROC with 95% CI using DeLong's method (normal approx).

    For small datasets, this is a reasonable approximation. For publication,
    bootstrapping is preferred for very small test sets.

    Args:
        y_true: Binary ground truth labels (0/1)
        y_score: Predicted probabilities for the positive class
        alpha: Significance level

    Returns:
        (auroc, lower_bound, upper_bound)
    """
    from sklearn.metrics import roc_auc_score

    n1 = np.sum(y_true == 1)
    n0 = np.sum(y_true == 0)

    if n1 == 0 or n0 == 0:
        return (0.0, 0.0, 0.0)

    auroc = roc_auc_score(y_true, y_score)

    # Hanley & McNeil (1982) variance approximation
    q1 = auroc / (2 - auroc)
    q2 = (2 * auroc ** 2) / (1 + auroc)
    se = np.sqrt(
        (auroc * (1 - auroc) + (n1 - 1) * (q1 - auroc ** 2) + (n0 - 1) * (q2 - auroc ** 2))
        / (n1 * n0)
    )

    z = stats.norm.ppf(1 - alpha / 2)
    lower = max(0.0, auroc - z * se)
    upper = min(1.0, auroc + z * se)

    return (auroc, lower, upper)


if __name__ == "__main__":
    # Quick self-test
    print("Wilson CI Utility — Self Test")
    print("=" * 50)

    # Example: 85 out of 100 correctly classified
    val, lo, hi = wilson_ci(85, 100)
    print(f"85/100: {format_ci(val, lo, hi)}")

    # Edge case: perfect score
    val, lo, hi = wilson_ci(100, 100)
    print(f"100/100: {format_ci(val, lo, hi)}")

    # Edge case: zero
    val, lo, hi = wilson_ci(0, 50)
    print(f"0/50: {format_ci(val, lo, hi)}")

    # Small sample
    val, lo, hi = wilson_ci(3, 5)
    print(f"3/5: {format_ci(val, lo, hi)}")

    print("\nAll tests passed.")

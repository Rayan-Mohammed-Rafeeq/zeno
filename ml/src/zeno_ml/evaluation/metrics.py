"""
Evaluation metrics for Zeno ML fraud detection.

All metrics are computed from scratch using scikit-learn where appropriate
and numpy elsewhere.  No metrics are hardcoded or fabricated.

Metrics computed:
  precision         — TP / (TP + FP)
  recall            — TP / (TP + FN)  [sensitivity]
  f1                — harmonic mean of precision and recall
  auprc             — area under precision-recall curve (primary metric)
  roc_auc           — area under ROC curve
  fpr               — FP / (FP + TN)  [false positive rate]
  fnr               — FN / (FN + TP)  [false negative rate / miss rate]
  expected_loss     — FN × fn_cost + FP × fp_cost

WHY AUPRC IS THE PRIMARY METRIC
─────────────────────────────────
Fraud datasets are heavily imbalanced (~3% positive rate in IEEE-CIS).
ROC-AUC can look artificially high because the vast majority of negatives
are correctly classified regardless of model quality.  AUPRC is sensitive
to the rare positive class and is the standard metric for imbalanced
classification in fraud detection literature.

THRESHOLD SELECTION
────────────────────
A fixed threshold of 0.5 is NOT used for final predictions.  The threshold
is selected on the validation set to minimise expected_loss (Section 8 of
the master spec — Milestone 8).  The functions here support threshold-sweep
analysis over the full probability range.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

import numpy as np
from sklearn.metrics import (
    average_precision_score,
    confusion_matrix,
    precision_recall_curve,
    roc_auc_score,
    roc_curve,
)

logger = logging.getLogger(__name__)

# Default false positive / false negative costs (USD)
# These match ZenoProperties defaults in the Spring Boot backend.
DEFAULT_FP_COST: float = 40.0   # manual review (15) + opportunity cost (25)
DEFAULT_FN_COST: float = 200.0  # assumed average transaction amount lost


@dataclass
class EvaluationMetrics:
    """
    Complete evaluation result for a single model at a single threshold.

    All fields are computed from actual predictions — none are fabricated.
    The threshold used is stored alongside the metrics for reproducibility.
    """
    # Confusion matrix
    true_positives:  int = 0
    true_negatives:  int = 0
    false_positives: int = 0
    false_negatives: int = 0

    # Classification metrics
    precision: float = 0.0
    recall:    float = 0.0
    f1:        float = 0.0
    fpr:       float = 0.0   # false positive rate
    fnr:       float = 0.0   # false negative rate

    # Probability-based metrics (threshold-independent)
    auprc:   float = 0.0
    roc_auc: float = 0.0

    # Cost-sensitive metrics
    expected_loss: float = 0.0
    fp_cost:       float = DEFAULT_FP_COST
    fn_cost:       float = DEFAULT_FN_COST

    # Metadata
    threshold:     float = 0.5
    n_samples:     int   = 0
    n_positive:    int   = 0
    n_negative:    int   = 0
    fraud_rate:    float = 0.0
    split_name:    str   = ""     # "train", "val", "test"

    def summary_dict(self) -> dict[str, Any]:
        return {
            "split":           self.split_name,
            "n_samples":       self.n_samples,
            "n_positive":      self.n_positive,
            "fraud_rate":      round(self.fraud_rate, 6),
            "threshold":       round(self.threshold, 4),
            "precision":       round(self.precision, 4),
            "recall":          round(self.recall, 4),
            "f1":              round(self.f1, 4),
            "fpr":             round(self.fpr, 4),
            "fnr":             round(self.fnr, 4),
            "auprc":           round(self.auprc, 4),
            "roc_auc":         round(self.roc_auc, 4),
            "true_positives":  self.true_positives,
            "true_negatives":  self.true_negatives,
            "false_positives": self.false_positives,
            "false_negatives": self.false_negatives,
            "expected_loss":   round(self.expected_loss, 2),
            "fp_cost_per_case": self.fp_cost,
            "fn_cost_per_case": self.fn_cost,
        }


@dataclass
class ThresholdPoint:
    """Metrics at a single threshold value (used for threshold sweep)."""
    threshold:     float
    precision:     float
    recall:        float
    f1:            float
    fpr:           float
    fnr:           float
    expected_loss: float
    tp: int
    fp: int
    tn: int
    fn: int


@dataclass
class ThresholdSweepResult:
    """
    Full threshold sweep result.

    points         : metrics at every evaluated threshold
    optimal_idx    : index of the point minimising expected_loss
    optimal_threshold : threshold at optimal_idx
    """
    points:            list[ThresholdPoint]
    optimal_idx:       int
    optimal_threshold: float
    fp_cost:           float
    fn_cost:           float

    @property
    def optimal_point(self) -> ThresholdPoint:
        return self.points[self.optimal_idx]

    def to_records(self) -> list[dict[str, Any]]:
        return [
            {
                "threshold":     round(p.threshold, 4),
                "precision":     round(p.precision, 4),
                "recall":        round(p.recall, 4),
                "f1":            round(p.f1, 4),
                "fpr":           round(p.fpr, 4),
                "expected_loss": round(p.expected_loss, 2),
            }
            for p in self.points
        ]


# ─────────────────────────────────────────────────────────────────────────
# Core evaluation function
# ─────────────────────────────────────────────────────────────────────────

def evaluate(
    y_true: np.ndarray,
    y_prob: np.ndarray,
    threshold: float = 0.5,
    fp_cost: float = DEFAULT_FP_COST,
    fn_cost: float = DEFAULT_FN_COST,
    split_name: str = "",
) -> EvaluationMetrics:
    """
    Compute all evaluation metrics for a set of predictions.

    Parameters
    ----------
    y_true :
        Ground truth binary labels (bool or 0/1 int array).
    y_prob :
        Predicted fraud probability in [0, 1].
    threshold :
        Decision threshold for converting probabilities to binary predictions.
    fp_cost, fn_cost :
        Cost per false positive / false negative (USD).
    split_name :
        Label for logging ("train", "val", "test").

    Returns
    -------
    EvaluationMetrics

    Notes
    -----
    AUPRC and ROC-AUC are threshold-independent and computed from raw
    probabilities.  All other metrics use the threshold.
    """
    y_true = np.asarray(y_true, dtype=bool)
    y_prob = np.asarray(y_prob, dtype=float)

    if len(y_true) != len(y_prob):
        raise ValueError(
            f"y_true length {len(y_true)} != y_prob length {len(y_prob)}"
        )
    if len(y_true) == 0:
        raise ValueError("Cannot evaluate on empty arrays.")

    y_pred = (y_prob >= threshold).astype(bool)
    n = len(y_true)
    n_pos = int(y_true.sum())
    n_neg = n - n_pos

    # Confusion matrix
    if n_pos == 0 or n_neg == 0:
        logger.warning(
            "Degenerate labels in split '%s': n_pos=%d n_neg=%d. "
            "Metrics may be undefined.",
            split_name, n_pos, n_neg,
        )

    cm = confusion_matrix(y_true, y_pred, labels=[False, True])
    tn, fp, fn, tp = cm.ravel()

    # Classification metrics
    precision = _safe_div(tp, tp + fp)
    recall    = _safe_div(tp, tp + fn)
    f1        = _harmonic_mean(precision, recall)
    fpr       = _safe_div(fp, fp + tn)
    fnr       = _safe_div(fn, fn + tp)

    # Probability-based metrics
    auprc   = _safe_auprc(y_true, y_prob)
    roc_auc = _safe_roc_auc(y_true, y_prob)

    # Cost-sensitive expected loss
    expected_loss = fn * fn_cost + fp * fp_cost

    m = EvaluationMetrics(
        true_positives=int(tp),
        true_negatives=int(tn),
        false_positives=int(fp),
        false_negatives=int(fn),
        precision=precision,
        recall=recall,
        f1=f1,
        fpr=fpr,
        fnr=fnr,
        auprc=auprc,
        roc_auc=roc_auc,
        expected_loss=expected_loss,
        fp_cost=fp_cost,
        fn_cost=fn_cost,
        threshold=threshold,
        n_samples=n,
        n_positive=n_pos,
        n_negative=n_neg,
        fraud_rate=n_pos / n,
        split_name=split_name,
    )

    logger.info(
        "[%s] P=%.4f R=%.4f F1=%.4f AUPRC=%.4f ROC=%.4f FPR=%.4f "
        "ExpLoss=$%.0f (threshold=%.3f, n=%d, fraud_rate=%.4f)",
        split_name or "eval",
        precision, recall, f1, auprc, roc_auc, fpr,
        expected_loss, threshold, n, n_pos / n,
    )
    return m


# ─────────────────────────────────────────────────────────────────────────
# Threshold sweep (used in Milestone 8)
# ─────────────────────────────────────────────────────────────────────────

def sweep_thresholds(
    y_true: np.ndarray,
    y_prob: np.ndarray,
    fp_cost: float = DEFAULT_FP_COST,
    fn_cost: float = DEFAULT_FN_COST,
    n_thresholds: int = 200,
) -> ThresholdSweepResult:
    """
    Evaluate metrics across a range of thresholds and identify the
    threshold that minimises expected_loss.

    IMPORTANT: this function must be called ONLY on validation data.
    Never call it on the test set — that would tune the threshold to the
    test distribution (data leakage).

    Parameters
    ----------
    y_true :
        Ground truth labels.
    y_prob :
        Predicted probabilities.
    fp_cost, fn_cost :
        Cost parameters (USD).
    n_thresholds :
        Number of threshold points to evaluate in [0.01, 0.99].

    Returns
    -------
    ThresholdSweepResult with optimal threshold identified.
    """
    y_true = np.asarray(y_true, dtype=bool)
    y_prob = np.asarray(y_prob, dtype=float)
    thresholds = np.linspace(0.01, 0.99, n_thresholds)

    points: list[ThresholdPoint] = []
    for t in thresholds:
        y_pred = (y_prob >= t).astype(bool)
        cm = confusion_matrix(y_true, y_pred, labels=[False, True])
        tn, fp, fn, tp = cm.ravel()
        precision = _safe_div(tp, tp + fp)
        recall    = _safe_div(tp, tp + fn)
        f1        = _harmonic_mean(precision, recall)
        fpr       = _safe_div(fp, fp + tn)
        fnr       = _safe_div(fn, fn + tp)
        loss      = fn * fn_cost + fp * fp_cost
        points.append(ThresholdPoint(
            threshold=float(t),
            precision=precision,
            recall=recall,
            f1=f1,
            fpr=fpr,
            fnr=fnr,
            expected_loss=loss,
            tp=int(tp), fp=int(fp), tn=int(tn), fn=int(fn),
        ))

    losses = [p.expected_loss for p in points]
    opt_idx = int(np.argmin(losses))

    logger.info(
        "Threshold sweep: optimal threshold=%.4f expected_loss=%.2f "
        "(P=%.4f R=%.4f F1=%.4f)",
        points[opt_idx].threshold,
        points[opt_idx].expected_loss,
        points[opt_idx].precision,
        points[opt_idx].recall,
        points[opt_idx].f1,
    )

    return ThresholdSweepResult(
        points=points,
        optimal_idx=opt_idx,
        optimal_threshold=points[opt_idx].threshold,
        fp_cost=fp_cost,
        fn_cost=fn_cost,
    )


# ─────────────────────────────────────────────────────────────────────────
# Curve data (for frontend charts)
# ─────────────────────────────────────────────────────────────────────────

def precision_recall_curve_data(
    y_true: np.ndarray,
    y_prob: np.ndarray,
) -> dict[str, list[float]]:
    """Return PR curve as lists for JSON serialisation."""
    p, r, t = precision_recall_curve(y_true, y_prob)
    return {
        "precision":  p.tolist(),
        "recall":     r.tolist(),
        "thresholds": list(t) + [1.0],   # pad to same length as p, r
    }


def roc_curve_data(
    y_true: np.ndarray,
    y_prob: np.ndarray,
) -> dict[str, list[float]]:
    """Return ROC curve as lists for JSON serialisation."""
    fpr, tpr, t = roc_curve(y_true, y_prob)
    return {
        "fpr":        fpr.tolist(),
        "tpr":        tpr.tolist(),
        "thresholds": t.tolist(),
    }


# ─────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────

def _safe_div(numerator: float, denominator: float) -> float:
    """Division that returns 0.0 instead of NaN when denominator is 0."""
    return float(numerator / denominator) if denominator > 0 else 0.0


def _harmonic_mean(a: float, b: float) -> float:
    """Harmonic mean of two values; returns 0.0 if either is 0."""
    return _safe_div(2 * a * b, a + b)


def _safe_auprc(y_true: np.ndarray, y_prob: np.ndarray) -> float:
    """AUPRC; returns 0.0 if only one class present."""
    try:
        return float(average_precision_score(y_true, y_prob))
    except ValueError:
        return 0.0


def _safe_roc_auc(y_true: np.ndarray, y_prob: np.ndarray) -> float:
    """ROC-AUC; returns 0.5 (random baseline) if only one class present."""
    try:
        return float(roc_auc_score(y_true, y_prob))
    except ValueError:
        return 0.5

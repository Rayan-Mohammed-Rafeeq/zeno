"""
Model monitoring: drift detection and prediction distribution tracking.

WHAT THIS MODULE DOES
──────────────────────
Tracks three types of observable shift between a training baseline and
recent production predictions:

1. Prediction drift — the distribution of fraud_probability scores has
   shifted relative to the training validation distribution.
   Metric: mean shift, std shift, fraction above threshold.

2. Feature drift — the mean or std of continuous features in recent data
   has shifted relative to training statistics.
   Metric: PSI (Population Stability Index) per feature bucket.

3. Data quality — the rate of missing/null feature values in recent data.

IMPORTANT LIMITATIONS (always surfaced in the API response)
──────────────────────────────────────────────────────────────
- This is a LIGHTWEIGHT monitoring system suitable for demonstration.
- It does NOT provide statistical guarantees (no p-values, no CI bounds).
- "Drift" here means "the recent distribution looks different from training".
  It does NOT prove the model has degraded.
- Real production drift monitoring requires calibrated historical baselines
  from a stable deployment period, not just the training set.

HOW DRIFT IS CLASSIFIED
────────────────────────
PSI thresholds (industry convention):
  PSI < 0.1   → LOW (distribution is stable)
  PSI < 0.25  → MEDIUM (minor shift, monitor closely)
  PSI >= 0.25 → HIGH (significant shift — investigate model performance)

Mean shift for predictions:
  |shift| < 0.05  → LOW
  |shift| < 0.15  → MEDIUM
  |shift| >= 0.15 → HIGH
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

import numpy as np

logger = logging.getLogger(__name__)

# PSI thresholds
PSI_LOW:    float = 0.10
PSI_MEDIUM: float = 0.25

# Prediction mean shift thresholds
PRED_LOW:    float = 0.05
PRED_MEDIUM: float = 0.15

# Min samples needed for drift computation to be meaningful
MIN_SAMPLES_FOR_DRIFT: int = 30


@dataclass
class PredictionDriftReport:
    """Drift report for the fraud_probability score distribution."""
    n_recent:           int
    mean_training:      float
    mean_recent:        float
    std_training:       float
    std_recent:         float
    mean_shift:         float
    fraction_above_threshold_training: float
    fraction_above_threshold_recent:   float
    drift_level:        str   # "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN"
    note:               str


@dataclass
class FeatureDriftReport:
    """Drift report for a single feature."""
    feature:      str
    psi:          float
    mean_train:   float
    mean_recent:  float
    drift_level:  str


@dataclass
class DataQualityReport:
    """Missing-value rate for each feature in recent data."""
    n_recent:           int
    missing_rate:       dict[str, float]
    high_missing_cols:  list[str]   # columns with missing_rate > 10%
    overall_quality:    str         # "GOOD" | "DEGRADED" | "POOR"


@dataclass
class MonitoringReport:
    """
    Combined monitoring report.

    All numbers come from actual model artefacts and recent predictions.
    Never fabricated.  If insufficient data is available, drift_level
    is set to "UNKNOWN" with an explanatory note.
    """
    model_version:    str
    feature_version:  str
    n_recent:         int
    prediction_drift: PredictionDriftReport
    feature_drift:    list[FeatureDriftReport]
    data_quality:     DataQualityReport
    overall_status:   str   # "HEALTHY" | "DEGRADED" | "CRITICAL"
    limitations:      str   = (
        "This is a lightweight monitoring system for demonstration. "
        "Drift classification uses simple statistical thresholds, not "
        "statistical tests with p-values. 'Drift' means the distribution "
        "looks different from training — it does NOT prove model degradation."
    )


# ─────────────────────────────────────────────────────────────────────────
# Core functions
# ─────────────────────────────────────────────────────────────────────────

def compute_prediction_drift(
    training_probs:  np.ndarray,
    recent_probs:    np.ndarray,
    threshold:       float = 0.5,
) -> PredictionDriftReport:
    """
    Compare the distribution of fraud_probability scores in recent data
    against the training validation distribution.
    """
    if len(recent_probs) < MIN_SAMPLES_FOR_DRIFT:
        return PredictionDriftReport(
            n_recent=len(recent_probs),
            mean_training=float(training_probs.mean()) if len(training_probs) > 0 else 0.0,
            mean_recent=float(recent_probs.mean()) if len(recent_probs) > 0 else 0.0,
            std_training=float(training_probs.std()) if len(training_probs) > 0 else 0.0,
            std_recent=float(recent_probs.std()) if len(recent_probs) > 0 else 0.0,
            mean_shift=0.0,
            fraction_above_threshold_training=0.0,
            fraction_above_threshold_recent=0.0,
            drift_level="UNKNOWN",
            note=f"Insufficient recent predictions ({len(recent_probs)} < {MIN_SAMPLES_FOR_DRIFT}). "
                 f"Score more transactions to enable drift monitoring.",
        )

    mean_train  = float(training_probs.mean())
    mean_recent = float(recent_probs.mean())
    std_train   = float(training_probs.std())
    std_recent  = float(recent_probs.std())
    mean_shift  = abs(mean_recent - mean_train)

    frac_train  = float((training_probs >= threshold).mean())
    frac_recent = float((recent_probs  >= threshold).mean())

    if mean_shift < PRED_LOW:
        level = "LOW"
    elif mean_shift < PRED_MEDIUM:
        level = "MEDIUM"
    else:
        level = "HIGH"

    note = (
        f"Mean shift: {mean_shift:.4f}. "
        f"Training mean: {mean_train:.4f}, recent mean: {mean_recent:.4f}. "
        f"Classification uses threshold {PRED_MEDIUM} for HIGH."
    )

    return PredictionDriftReport(
        n_recent=len(recent_probs),
        mean_training=round(mean_train, 4),
        mean_recent=round(mean_recent, 4),
        std_training=round(std_train, 4),
        std_recent=round(std_recent, 4),
        mean_shift=round(mean_shift, 4),
        fraction_above_threshold_training=round(frac_train, 4),
        fraction_above_threshold_recent=round(frac_recent, 4),
        drift_level=level,
        note=note,
    )


def compute_feature_drift(
    training_stats: dict[str, dict[str, float]],
    recent_features: np.ndarray,
    feature_names:   list[str],
    top_n:           int = 10,
) -> list[FeatureDriftReport]:
    """
    Compute PSI-based feature drift for the top_n most important features.

    Parameters
    ----------
    training_stats :
        Dict of {feature_name: {"mean": float, "std": float}} from training.
    recent_features :
        Feature matrix of recent predictions, shape (n, len(feature_names)).
    feature_names :
        Ordered feature names matching columns of recent_features.
    top_n :
        Number of features to check (most SHAP-important, or first N alphabetically).
    """
    if len(recent_features) < MIN_SAMPLES_FOR_DRIFT:
        return []

    reports: list[FeatureDriftReport] = []
    check_cols = feature_names[:top_n]

    for i, feat in enumerate(feature_names):
        if feat not in check_cols:
            continue
        if i >= recent_features.shape[1]:
            continue

        col_data   = recent_features[:, i].astype(float)
        train_info = training_stats.get(feat)
        if train_info is None:
            continue

        mean_train  = train_info.get("mean", 0.0)
        std_train   = max(train_info.get("std", 1.0), 1e-8)
        mean_recent = float(col_data.mean())

        psi = _compute_psi_simple(col_data, mean_train, std_train)

        if psi < PSI_LOW:
            level = "LOW"
        elif psi < PSI_MEDIUM:
            level = "MEDIUM"
        else:
            level = "HIGH"

        reports.append(FeatureDriftReport(
            feature=feat,
            psi=round(psi, 4),
            mean_train=round(mean_train, 4),
            mean_recent=round(mean_recent, 4),
            drift_level=level,
        ))

    # Sort by PSI descending
    reports.sort(key=lambda r: r.psi, reverse=True)
    return reports


def compute_data_quality(
    recent_features: np.ndarray,
    feature_names:   list[str],
) -> DataQualityReport:
    """Compute missing-value (NaN) rates for each feature in recent data."""
    n = len(recent_features)
    missing_rate: dict[str, float] = {}

    if n == 0:
        return DataQualityReport(
            n_recent=0,
            missing_rate={},
            high_missing_cols=[],
            overall_quality="UNKNOWN",
        )

    for i, feat in enumerate(feature_names):
        if i >= recent_features.shape[1]:
            break
        rate = float(np.isnan(recent_features[:, i]).mean())
        if rate > 0:
            missing_rate[feat] = round(rate, 4)

    high_missing = [f for f, r in missing_rate.items() if r > 0.10]
    max_rate = max(missing_rate.values(), default=0.0)

    if max_rate < 0.02:
        quality = "GOOD"
    elif max_rate < 0.10:
        quality = "DEGRADED"
    else:
        quality = "POOR"

    return DataQualityReport(
        n_recent=n,
        missing_rate=missing_rate,
        high_missing_cols=high_missing,
        overall_quality=quality,
    )


def build_monitoring_report(
    prediction_drift: PredictionDriftReport,
    feature_drift:    list[FeatureDriftReport],
    data_quality:     DataQualityReport,
    model_version:    str,
    feature_version:  str,
) -> MonitoringReport:
    """Combine all three reports into a single monitoring status."""
    # Overall status = worst of the three
    levels = {
        "UNKNOWN":  0,
        "LOW":      1,
        "MEDIUM":   2,
        "HIGH":     3,
        "GOOD":     1,
        "DEGRADED": 2,
        "POOR":     3,
    }
    scores = [
        levels.get(prediction_drift.drift_level, 0),
        max((levels.get(r.drift_level, 0) for r in feature_drift), default=0),
        levels.get(data_quality.overall_quality, 0),
    ]
    worst = max(scores)
    if worst >= 3:
        status = "CRITICAL"
    elif worst >= 2:
        status = "DEGRADED"
    else:
        status = "HEALTHY"

    return MonitoringReport(
        model_version=model_version,
        feature_version=feature_version,
        n_recent=prediction_drift.n_recent,
        prediction_drift=prediction_drift,
        feature_drift=feature_drift,
        data_quality=data_quality,
        overall_status=status,
    )


# ─────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────

def _compute_psi_simple(
    recent_vals: np.ndarray,
    train_mean:  float,
    train_std:   float,
    n_bins:      int = 10,
) -> float:
    """
    Simplified PSI using quantile bins defined by training mean/std.

    PSI = Σ (actual% - expected%) × ln(actual% / expected%)

    We use a normal approximation for the expected distribution
    (mean ± 3σ split into n_bins buckets).
    """
    eps = 1e-8
    # Bin edges: training mean ± 3 std
    low  = train_mean - 3 * train_std
    high = train_mean + 3 * train_std
    bins = np.linspace(low, high, n_bins + 1)

    # Expected counts from a normal distribution approximation
    from scipy.stats import norm  # type: ignore[import]
    expected_fracs = np.diff(norm.cdf(bins, loc=train_mean, scale=train_std + eps))
    expected_fracs = np.clip(expected_fracs, eps, None)
    expected_fracs /= expected_fracs.sum()

    # Actual counts from recent data
    actual_counts, _ = np.histogram(recent_vals, bins=bins)
    actual_fracs = actual_counts.astype(float)
    # Add count for out-of-range values to boundary buckets
    actual_fracs[0]  += (recent_vals < bins[0]).sum()
    actual_fracs[-1] += (recent_vals > bins[-1]).sum()
    actual_fracs = np.clip(actual_fracs, eps, None)
    actual_fracs /= actual_fracs.sum()

    psi = float(np.sum((actual_fracs - expected_fracs) * np.log(actual_fracs / expected_fracs)))
    return max(0.0, psi)

"""
Probability calibration for XGBoost fraud classifier.

WHY CALIBRATION MATTERS
────────────────────────
XGBoost's raw output probabilities are not always well-calibrated.
A score of 0.8 should mean "this transaction is fraud 80% of the time"
for the threshold-to-cost mapping to be meaningful.

If the model is overconfident (probabilities clustered near 0 and 1)
or underconfident (probabilities clustered near 0.5), the optimal
threshold selected by sweep_thresholds() will still work correctly
in a relative sense, but the absolute cost estimates will be off.

CALIBRATION APPROACHES
────────────────────────
1. Platt scaling (sigmoid):  fits a logistic regression on the raw
   log-odds.  Fast, parametric, well-suited for monotone miscalibration.
2. Isotonic regression:       non-parametric, more flexible, can overfit
   on small calibration sets.

Both are evaluated on the validation set using ECE (expected calibration
error) and a reliability diagram.  The better approach is selected and
the calibrator is stored alongside the model.

LEAKAGE PREVENTION
───────────────────
The calibrator is fit on a HELD-OUT CALIBRATION SPLIT of the validation
data — it must NEVER be fit on training data (that would be leakage) or
on the test data (that would corrupt the held-out evaluation).

We split the validation set 50/50:
  val[:50%]  → used to select threshold (as before)
  val[50%:]  → used to fit the calibrator

This is conservative but safe.  On larger datasets, a 20/80 split is
acceptable.
"""

from __future__ import annotations

import logging
import pickle
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import numpy as np
from sklearn.calibration import CalibratedClassifierCV, calibration_curve
from sklearn.linear_model import LogisticRegression

logger = logging.getLogger(__name__)

_EPS = 1e-7


@dataclass
class CalibrationResult:
    """
    Output of evaluate_calibration().

    before_ece : Expected Calibration Error before calibration
    after_ece  : Expected Calibration Error after calibration
    method     : 'sigmoid' | 'isotonic' | 'none' (if calibration made things worse)
    calibrator : fitted calibrator object (None if not applied)
    curve_before : (fraction_of_positives, mean_predicted_value) before
    curve_after  : (fraction_of_positives, mean_predicted_value) after
    """
    before_ece:   float
    after_ece:    float
    method:       str
    calibrator:   Any
    improvement:  float   # before_ece - after_ece; positive = improvement
    curve_before: tuple[list[float], list[float]] = field(default_factory=lambda: ([], []))
    curve_after:  tuple[list[float], list[float]] = field(default_factory=lambda: ([], []))

    def summary(self) -> str:
        return (
            f"Calibration: {self.method}  "
            f"ECE before={self.before_ece:.4f}  "
            f"ECE after={self.after_ece:.4f}  "
            f"improvement={self.improvement:.4f}"
        )


def evaluate_calibration(
    y_cal:     np.ndarray,
    probs_raw: np.ndarray,
    n_bins:    int = 10,
) -> CalibrationResult:
    """
    Evaluate calibration quality and fit both Platt and isotonic calibrators.
    Select the method with lower ECE.

    Parameters
    ----------
    y_cal     : ground truth labels for the calibration split
    probs_raw : raw model probabilities on the calibration split
    n_bins    : number of bins for ECE computation

    Returns
    -------
    CalibrationResult with the selected method and fitted calibrator
    """
    before_ece, before_fop, before_mpv = _compute_ece(y_cal, probs_raw, n_bins)
    logger.info("ECE before calibration: %.4f", before_ece)

    # Platt (sigmoid)
    platt_cal    = _fit_platt(probs_raw, y_cal)
    platt_probs  = _apply_calibrator(platt_cal, probs_raw)
    platt_ece, platt_fop, platt_mpv = _compute_ece(y_cal, platt_probs, n_bins)

    # Isotonic
    iso_cal   = _fit_isotonic(probs_raw, y_cal)
    iso_probs = _apply_calibrator(iso_cal, probs_raw)
    iso_ece, iso_fop, iso_mpv = _compute_ece(y_cal, iso_probs, n_bins)

    logger.info("ECE sigmoid=%.4f  isotonic=%.4f", platt_ece, iso_ece)

    # Select: whichever has lower ECE, but only if it improves over raw
    if min(platt_ece, iso_ece) < before_ece:
        if platt_ece <= iso_ece:
            method, best_cal, best_ece = "sigmoid", platt_cal, platt_ece
            after_fop, after_mpv = platt_fop, platt_mpv
        else:
            method, best_cal, best_ece = "isotonic", iso_cal, iso_ece
            after_fop, after_mpv = iso_fop, iso_mpv
    else:
        method, best_cal, best_ece = "none", None, before_ece
        after_fop, after_mpv = before_fop, before_mpv
        logger.info("Calibration did not improve ECE — keeping raw probabilities.")

    result = CalibrationResult(
        before_ece  = before_ece,
        after_ece   = best_ece,
        method      = method,
        calibrator  = best_cal,
        improvement = before_ece - best_ece,
        curve_before = (before_fop.tolist(), before_mpv.tolist()),
        curve_after  = (after_fop.tolist(),  after_mpv.tolist()),
    )
    logger.info(result.summary())
    return result


def apply_calibration(
    calibrator: Any,
    probs_raw:  np.ndarray,
) -> np.ndarray:
    """Apply a fitted calibrator to raw probabilities."""
    if calibrator is None:
        return probs_raw
    return _apply_calibrator(calibrator, probs_raw)


def save_calibrator(calibrator: Any, path: Path | str) -> None:
    with open(path, "wb") as f:
        pickle.dump(calibrator, f)


def load_calibrator(path: Path | str) -> Any:
    with open(path, "rb") as f:
        return pickle.load(f)


# ─────────────────────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────────────────────

def _compute_ece(
    y_true: np.ndarray,
    probs:  np.ndarray,
    n_bins: int = 10,
) -> tuple[float, np.ndarray, np.ndarray]:
    """
    Compute Expected Calibration Error.

    ECE = Σ_b (|B_b|/n) × |acc(B_b) - conf(B_b)|

    where B_b is the set of samples in bin b,
    acc is the fraction of positives, conf is the mean predicted probability.
    """
    fop, mpv = calibration_curve(y_true, probs, n_bins=n_bins, strategy="uniform")
    # Bin counts for weighting
    bins = np.linspace(0.0, 1.0 + _EPS, n_bins + 1)
    bin_idx = np.digitize(probs, bins) - 1
    bin_idx = np.clip(bin_idx, 0, n_bins - 1)
    n = len(probs)
    ece = 0.0
    for b in range(len(fop)):
        mask    = bin_idx == b
        n_b     = mask.sum()
        if n_b == 0:
            continue
        acc_b   = float(y_true[mask].mean())
        conf_b  = float(probs[mask].mean())
        ece    += (n_b / n) * abs(acc_b - conf_b)
    return ece, fop, mpv


def _fit_platt(probs: np.ndarray, y: np.ndarray) -> Any:
    """Fit Platt scaling: logistic regression on log-odds of raw probs."""
    log_odds = np.log(np.clip(probs, _EPS, 1 - _EPS) /
                      np.clip(1 - probs, _EPS, 1 - _EPS)).reshape(-1, 1)
    cal = LogisticRegression(C=1e10, solver="lbfgs", max_iter=500)
    cal.fit(log_odds, y.astype(int))
    return ("platt", cal)


def _fit_isotonic(probs: np.ndarray, y: np.ndarray) -> Any:
    """Fit isotonic regression calibrator."""
    from sklearn.isotonic import IsotonicRegression
    cal = IsotonicRegression(out_of_bounds="clip")
    cal.fit(probs, y.astype(float))
    return ("isotonic", cal)


def _apply_calibrator(calibrator: Any, probs: np.ndarray) -> np.ndarray:
    method, cal = calibrator
    if method == "platt":
        log_odds = np.log(np.clip(probs, _EPS, 1 - _EPS) /
                          np.clip(1 - probs, _EPS, 1 - _EPS)).reshape(-1, 1)
        return cal.predict_proba(log_odds)[:, 1]
    elif method == "isotonic":
        return cal.predict(probs)
    return probs

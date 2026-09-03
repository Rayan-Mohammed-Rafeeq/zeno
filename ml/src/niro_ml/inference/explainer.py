"""
SHAP explainability for individual fraud predictions.

WHY SHAP
─────────
SHAP (SHapley Additive exPlanations) provides mathematically consistent
feature attributions based on cooperative game theory.  For tree-based
models like XGBoost, SHAP TreeExplainer computes exact values in
O(TLD^2) time — fast enough for production use.

IMPORTANT LIMITATIONS (always surfaced to analysts)
─────────────────────────────────────────────────────
1. SHAP explains the model's prediction, NOT the ground truth.
   A high SHAP value means the feature pushed the model toward fraud,
   not that the feature is necessarily evidence of real fraud.

2. SHAP does not prove causality.  A high ip_customer_count SHAP value
   means the model relied heavily on this feature, but sharing an IP
   address could be legitimate (office, family, VPN).

3. Correlation between features can distribute SHAP values in
   non-intuitive ways.

These limitations are surfaced in every FeatureContribution object
via the `disclaimer` field and in the UI.

OUTPUT FORMAT
─────────────
For every prediction, we return:
  - top_positive: features that pushed the score TOWARD fraud (shap > 0)
  - top_negative: features that pushed the score AWAY from fraud (shap < 0)
  - baseline_value: the model's expected output without any features

This maps to the `featureContributions` list in the FastAPI PredictResponse.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

import numpy as np

logger = logging.getLogger(__name__)

_SHAP_DISCLAIMER = (
    "SHAP explains the model prediction, not ground truth. "
    "High values indicate model reliance on this feature, not causality."
)


@dataclass
class FeatureContribution:
    """
    SHAP-derived contribution for a single feature in a single prediction.
    """
    feature:    str
    shap_value: float
    direction:  str    # "POSITIVE" | "NEGATIVE" | "NEUTRAL"
    rank:       int    # 1 = strongest absolute contributor
    disclaimer: str    = field(default=_SHAP_DISCLAIMER)

    def to_dict(self) -> dict[str, Any]:
        return {
            "feature":    self.feature,
            "shapValue":  round(self.shap_value, 6),
            "direction":  self.direction,
            "rank":       self.rank,
            "disclaimer": self.disclaimer,
        }


@dataclass
class ExplanationResult:
    """
    Complete SHAP explanation for a single prediction.
    """
    fraud_probability:  float
    baseline_value:     float
    top_positive:       list[FeatureContribution]   # shap > 0, sorted by |shap|
    top_negative:       list[FeatureContribution]   # shap < 0, sorted by |shap|
    all_contributions:  list[FeatureContribution]   # all features, sorted by |shap|
    model_version:      str = ""

    def top_n(self, n: int = 10) -> list[FeatureContribution]:
        """Return top-n features by absolute SHAP value."""
        return self.all_contributions[:n]

    def to_dict(self) -> dict[str, Any]:
        return {
            "fraudProbability": round(self.fraud_probability, 6),
            "baselineValue":    round(self.baseline_value, 6),
            "topPositive":      [c.to_dict() for c in self.top_positive],
            "topNegative":      [c.to_dict() for c in self.top_negative],
            "disclaimer":       _SHAP_DISCLAIMER,
        }


class SHAPExplainer:
    """
    SHAP TreeExplainer wrapper for the XGBoost fraud model.

    Usage
    ─────
    explainer = SHAPExplainer(xgb_model)
    result    = explainer.explain_single(X_row, fraud_probability=0.87)
    """

    def __init__(
        self,
        model:          Any,
        feature_names:  list[str],
        model_version:  str = "",
        top_n:          int = 10,
    ) -> None:
        """
        Parameters
        ----------
        model :
            Trained XGBoost model (XGBClassifier or Booster).
        feature_names :
            Ordered list of feature column names — must match the order
            of columns in the feature matrix passed to the model.
        top_n :
            Number of top contributors to return per prediction.
        """
        self.model_version = model_version
        self.feature_names = feature_names
        self.top_n         = top_n
        self._explainer    = None
        self._baseline     = 0.0

        try:
            import shap
            self._explainer = shap.TreeExplainer(model)
            # Baseline = expected model output (log-odds, then converted)
            ev = self._explainer.expected_value
            self._baseline = float(ev[1] if hasattr(ev, "__len__") else ev)
            logger.info(
                "SHAP TreeExplainer initialised. Baseline log-odds: %.4f",
                self._baseline,
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("SHAP init failed: %s. Explanations will be empty.", exc)

    @property
    def is_available(self) -> bool:
        return self._explainer is not None

    def explain_single(
        self,
        X_row:             np.ndarray,
        fraud_probability: float,
    ) -> ExplanationResult:
        """
        Compute SHAP values for a single row (shape: (1, n_features) or (n_features,)).

        Returns ExplanationResult with empty contributions if SHAP is unavailable.
        """
        if not self.is_available:
            return self._empty_result(fraud_probability)

        if X_row.ndim == 1:
            X_row = X_row.reshape(1, -1)

        try:
            shap_values = self._explainer.shap_values(X_row)
            # For binary classifiers shap_values may be (2, 1, n_features) or (1, n_features)
            sv = _extract_positive_class_shap(shap_values, row_idx=0)
            return self._build_result(sv, fraud_probability)
        except Exception as exc:  # noqa: BLE001
            logger.warning("SHAP explanation failed: %s", exc)
            return self._empty_result(fraud_probability)

    def explain_batch(
        self,
        X:                  np.ndarray,
        fraud_probabilities: np.ndarray,
    ) -> list[ExplanationResult]:
        """
        Compute SHAP values for a batch of rows.
        More efficient than calling explain_single in a loop.
        """
        if not self.is_available:
            return [self._empty_result(fp) for fp in fraud_probabilities]

        try:
            shap_values = self._explainer.shap_values(X)
            results = []
            for i, fp in enumerate(fraud_probabilities):
                sv = _extract_positive_class_shap(shap_values, row_idx=i)
                results.append(self._build_result(sv, float(fp)))
            return results
        except Exception as exc:  # noqa: BLE001
            logger.warning("Batch SHAP failed: %s", exc)
            return [self._empty_result(fp) for fp in fraud_probabilities]

    # ── Private helpers ───────────────────────────────────────────────────

    def _build_result(
        self,
        shap_vals: np.ndarray,
        fraud_probability: float,
    ) -> ExplanationResult:
        n = len(shap_vals)
        names = self.feature_names[:n]

        all_contributions = []
        for i, (name, sv) in enumerate(zip(names, shap_vals)):
            direction = "POSITIVE" if sv > 0 else ("NEGATIVE" if sv < 0 else "NEUTRAL")
            all_contributions.append(FeatureContribution(
                feature=name, shap_value=float(sv),
                direction=direction, rank=0,
            ))

        # Sort by absolute value descending
        all_contributions.sort(key=lambda c: abs(c.shap_value), reverse=True)
        for rank, c in enumerate(all_contributions, 1):
            c.rank = rank

        top_n   = self.top_n
        top_pos = [c for c in all_contributions if c.direction == "POSITIVE"][:top_n]
        top_neg = [c for c in all_contributions if c.direction == "NEGATIVE"][:top_n]

        return ExplanationResult(
            fraud_probability = fraud_probability,
            baseline_value    = self._baseline,
            top_positive      = top_pos,
            top_negative      = top_neg,
            all_contributions = all_contributions[:top_n * 2],
            model_version     = self.model_version,
        )

    def _empty_result(self, fraud_probability: float) -> ExplanationResult:
        return ExplanationResult(
            fraud_probability = fraud_probability,
            baseline_value    = self._baseline,
            top_positive      = [],
            top_negative      = [],
            all_contributions = [],
            model_version     = self.model_version,
        )


# ─────────────────────────────────────────────────────────────────────────
# Helper: extract positive-class SHAP values from XGBoost output
# ─────────────────────────────────────────────────────────────────────────

def _extract_positive_class_shap(shap_values: Any, row_idx: int) -> np.ndarray:
    """
    XGBoost's TreeExplainer returns SHAP values in different shapes
    depending on the version and whether it's binary or multi-class.

    Handles:
      - shape (n_rows, n_features)        — XGBoost binary
      - shape (2, n_rows, n_features)     — sklearn multi-output
      - list of 2 arrays                  — old shap versions
    """
    import numpy as np

    if isinstance(shap_values, list):
        # List of arrays, one per class — take class 1 (fraud)
        sv = shap_values[1]
        return np.array(sv[row_idx])

    sv = np.array(shap_values)
    if sv.ndim == 3:
        # (2, n_rows, n_features) — take class 1
        return sv[1, row_idx, :]
    if sv.ndim == 2:
        # (n_rows, n_features)
        return sv[row_idx, :]
    # Fallback
    return sv

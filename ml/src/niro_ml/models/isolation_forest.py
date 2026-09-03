"""
Isolation Forest anomaly detector.

PURPOSE
───────
The Isolation Forest detects behaviorally anomalous transactions that
deviate from the norm even when they do not resemble labeled fraud patterns.

This answers the question:
  "Is this behavior unusual, regardless of whether it looks like known fraud?"

It is INDEPENDENT of the supervised XGBoost signal — the two scores are
kept separate and only combined in the risk aggregator (aggregator.py).
Merging them without validation would risk degrading the supervised signal.

DESIGN
──────
• Trained ONLY on training data — no labels used (unsupervised).
• Uses behavioral + device/IP features most sensitive to anomalies.
• contamination parameter is set to the observed fraud rate in training
  data as an informed starting point (can be tuned on validation).
• Output is the raw score_samples() value, normalised to [0,1] by
  aggregator.normalize_anomaly_score().

WHAT IT CAPTURES THAT XGBOOST MISSES
──────────────────────────────────────
• Novel fraud patterns not in the training labels (zero-day fraud).
• Unusual-but-legitimate transactions that inflate fraud probability.
• Structural anomalies: extreme velocity, extreme amounts, novel devices.

WHAT IT DOES NOT REPLACE
─────────────────────────
• It cannot use label information — it has no concept of "fraud".
• It will flag unusual legitimate transactions (high-value, VPN users).
• Its scores are not probabilities and must not be interpreted as such.
"""

from __future__ import annotations

import logging
import pickle
from pathlib import Path
from typing import Any

import numpy as np
from sklearn.ensemble import IsolationForest

logger = logging.getLogger(__name__)

# Features most sensitive to behavioral anomalies
# (a subset of ALL_FEATURE_COLUMNS)
ANOMALY_FEATURES: list[str] = [
    "log_amount",
    "amount_zscore",
    "tx_count_5min",
    "tx_count_1h",
    "tx_count_24h",
    "amount_sum_1h",
    "amount_sum_24h",
    "customers_per_device",
    "tx_per_device_24h",
    "device_velocity_1h",
    "customers_per_ip",
    "tx_per_ip_24h",
    "ip_velocity_1h",
    "devices_per_ip",
    "seconds_since_prev_tx",
    "amount_change_pct",
    "velocity_acceleration",
    "repeated_amount",
    "account_age_days",
    "historical_refund_rate",
]

DEFAULT_IF_PARAMS: dict[str, Any] = {
    "n_estimators":  200,
    "max_samples":   "auto",
    "max_features":  1.0,
    "bootstrap":     False,
    "random_state":  42,
    "n_jobs":        -1,
}


class AnomalyDetector:
    """
    Isolation Forest wrapper with feature subsetting and persistence.
    """

    def __init__(
        self,
        contamination: float | str = "auto",
        params: dict[str, Any] | None = None,
    ) -> None:
        self.contamination = contamination
        self.params        = {**DEFAULT_IF_PARAMS, **(params or {})}
        self.model: IsolationForest | None = None
        self.feature_indices: list[int] = []   # indices into ALL_FEATURE_COLUMNS

    # ── Training ─────────────────────────────────────────────────────────

    def fit(
        self,
        X_train:       np.ndarray,
        y_train:       np.ndarray,
        feature_names: list[str],
    ) -> "AnomalyDetector":
        """
        Train the Isolation Forest on training data ONLY.

        y_train is accepted only to compute contamination from the observed
        fraud rate — it is NOT used for anything else (this is unsupervised).

        Parameters
        ----------
        X_train       : training feature matrix (n_samples, n_features)
        y_train       : training labels — ONLY used to set contamination
        feature_names : column names matching X_train columns
        """
        # Compute feature subset indices
        self.feature_indices = [
            i for i, name in enumerate(feature_names)
            if name in ANOMALY_FEATURES
        ]
        if not self.feature_indices:
            logger.warning(
                "No ANOMALY_FEATURES found in feature_names. "
                "Using all features for Isolation Forest."
            )
            self.feature_indices = list(range(len(feature_names)))

        X_subset = X_train[:, self.feature_indices]

        # Set contamination from observed fraud rate in training data
        if self.contamination == "auto":
            fraud_rate = float(y_train.mean())
            # Clamp to valid range [0.001, 0.5]
            contamination = max(0.001, min(0.5, fraud_rate))
        else:
            contamination = float(self.contamination)

        logger.info(
            "Training Isolation Forest: n_train=%d, n_features=%d/%d, "
            "contamination=%.4f",
            len(X_train), len(self.feature_indices), X_train.shape[1],
            contamination,
        )

        self.model = IsolationForest(
            contamination=contamination,
            **self.params,
        )
        self.model.fit(X_subset)

        # Log distribution of scores on training data
        train_scores = self.model.score_samples(X_subset)
        logger.info(
            "IF training scores: mean=%.4f std=%.4f min=%.4f max=%.4f",
            train_scores.mean(), train_scores.std(),
            train_scores.min(), train_scores.max(),
        )
        return self

    # ── Inference ────────────────────────────────────────────────────────

    def score(self, X: np.ndarray) -> np.ndarray:
        """
        Return raw anomaly scores for X.

        Lower scores = more anomalous (Isolation Forest convention).
        Normalise to [0,1] using aggregator.normalize_anomaly_score().
        """
        if self.model is None:
            raise RuntimeError("AnomalyDetector not trained. Call fit() first.")
        X_sub = X[:, self.feature_indices]
        return self.model.score_samples(X_sub)

    def score_single(self, x: np.ndarray) -> float:
        """Score a single row (1D or 2D with shape (1, n_features))."""
        if x.ndim == 1:
            x = x.reshape(1, -1)
        return float(self.score(x)[0])

    def validate(
        self,
        X_val:  np.ndarray,
        y_val:  np.ndarray,
    ) -> dict[str, float]:
        """
        Compute descriptive statistics of anomaly scores on validation data.

        We cannot compute standard classification metrics for the IF because
        it is unsupervised — we instead check whether fraudulent transactions
        tend to have higher anomaly scores than legitimate ones.
        """
        if self.model is None:
            raise RuntimeError("Not trained.")
        scores      = self.score(X_val)
        fraud_mask  = y_val.astype(bool)
        legit_mask  = ~fraud_mask

        stats: dict[str, float] = {
            "mean_score_fraud":  float(scores[fraud_mask].mean()) if fraud_mask.any() else 0.0,
            "mean_score_legit":  float(scores[legit_mask].mean()) if legit_mask.any() else 0.0,
            "std_score_fraud":   float(scores[fraud_mask].std())  if fraud_mask.any() else 0.0,
            "std_score_legit":   float(scores[legit_mask].std())  if legit_mask.any() else 0.0,
        }
        # Separation: fraud scores should be LOWER (more anomalous)
        stats["score_separation"] = stats["mean_score_legit"] - stats["mean_score_fraud"]
        logger.info(
            "IF validation: fraud_mean=%.4f legit_mean=%.4f separation=%.4f",
            stats["mean_score_fraud"], stats["mean_score_legit"], stats["score_separation"],
        )
        return stats

    # ── Persistence ───────────────────────────────────────────────────────

    def save(self, output_dir: Path | str) -> dict[str, Path]:
        out = Path(output_dir)
        out.mkdir(parents=True, exist_ok=True)
        artefacts: dict[str, Path] = {}

        model_path = out / "isolation_forest.pkl"
        with open(model_path, "wb") as f:
            pickle.dump(self, f)   # save entire detector (model + indices)
        artefacts["isolation_forest.pkl"] = model_path

        logger.info("AnomalyDetector saved to %s", out)
        return artefacts

    @classmethod
    def load(cls, model_dir: Path | str) -> "AnomalyDetector":
        path = Path(model_dir) / "isolation_forest.pkl"
        with open(path, "rb") as f:
            return pickle.load(f)

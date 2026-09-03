"""
Logistic Regression baseline model.

Purpose
───────
Establishes a scientifically meaningful lower bound for fraud detection
performance.  Every subsequent model (XGBoost, calibrated XGBoost, XGBoost
+ graph features) must outperform this baseline on AUPRC to justify the
added complexity.

Design
──────
• Uses scikit-learn LogisticRegression with class_weight='balanced' to
  handle the severe class imbalance (~3% fraud in IEEE-CIS).
• Evaluated with the same temporal split and the same feature pipeline as
  XGBoost — this is the only valid comparison.
• All hyperparameters, metrics, and artefacts are logged to MLflow.
• The threshold is selected on validation data only (sweep_thresholds).
  The test set is evaluated ONCE with the frozen validation-optimal threshold.

Class imbalance handling
────────────────────────
class_weight='balanced' is equivalent to weighting each sample by
  n_samples / (n_classes × class_count)
which upweights the rare fraud class.  Alternative approaches
(SMOTE, random oversampling) are NOT applied here because:
  1. They must be applied only to training data — trivial to violate.
  2. The test set must NOT be rebalanced.
  3. Threshold optimisation on validation data achieves the same effect
     without generating synthetic samples.
"""

from __future__ import annotations

import logging
import pickle
from pathlib import Path
from typing import Any

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler

from niro_ml.evaluation.metrics import EvaluationMetrics, evaluate, sweep_thresholds
from niro_ml.features.base import FEATURE_VERSION

logger = logging.getLogger(__name__)

# ── Default hyperparameters ───────────────────────────────────────────────
BASELINE_HYPERPARAMS: dict[str, Any] = {
    "C":            1.0,       # inverse regularisation strength
    "max_iter":     1000,
    "solver":       "lbfgs",
    "class_weight": "balanced",
    "random_state": 42,
    "n_jobs":       -1,
}


class BaselineModel:
    """
    Wrapper around LogisticRegression that carries the scaler, threshold,
    and evaluation results as a single reusable object.
    """

    def __init__(self, hyperparams: dict[str, Any] | None = None) -> None:
        self.hyperparams    = hyperparams or BASELINE_HYPERPARAMS.copy()
        self.model:    LogisticRegression | None = None
        self.scaler:   StandardScaler | None     = None
        self.threshold: float = 0.5
        self.feature_version: str = FEATURE_VERSION
        self.val_metrics:  EvaluationMetrics | None = None
        self.test_metrics: EvaluationMetrics | None = None

    # ── Training ─────────────────────────────────────────────────────────

    def fit(
        self,
        X_train: np.ndarray,
        y_train: np.ndarray,
        X_val:   np.ndarray,
        y_val:   np.ndarray,
        fp_cost: float = 40.0,
        fn_cost: float = 200.0,
        fit_scaler: bool = True,
    ) -> "BaselineModel":
        """
        Train the model and select threshold on validation data.

        Parameters
        ----------
        X_train, y_train : training feature matrix and labels
        X_val,   y_val   : validation feature matrix and labels
        fp_cost, fn_cost : cost parameters for threshold optimization
        fit_scaler       : if True, fit+transform train; transform val.
                           Logistic Regression benefits from scaling; XGBoost
                           does not (handled separately).

        Returns self for chaining.
        """
        logger.info(
            "Fitting LogisticRegression baseline: n_train=%d, n_val=%d, "
            "fraud_rate_train=%.4f, fraud_rate_val=%.4f",
            len(y_train), len(y_val),
            y_train.mean(), y_val.mean(),
        )

        # Scale features (Logistic Regression is sensitive to scale)
        if fit_scaler:
            self.scaler = StandardScaler()
            X_train_s = self.scaler.fit_transform(X_train)
            X_val_s   = self.scaler.transform(X_val)
        else:
            X_train_s, X_val_s = X_train, X_val
            self.scaler = None

        # Train
        self.model = LogisticRegression(**self.hyperparams)
        self.model.fit(X_train_s, y_train.astype(int))
        logger.info("Training complete.")

        # Validation probabilities
        val_probs = self.model.predict_proba(X_val_s)[:, 1]

        # Threshold sweep on validation — NEVER on test
        sweep = sweep_thresholds(y_val, val_probs, fp_cost=fp_cost, fn_cost=fn_cost)
        self.threshold = sweep.optimal_threshold

        # Validation metrics at optimal threshold
        self.val_metrics = evaluate(
            y_val, val_probs,
            threshold=self.threshold,
            fp_cost=fp_cost,
            fn_cost=fn_cost,
            split_name="validation",
        )

        logger.info(
            "Baseline validation: AUPRC=%.4f F1=%.4f threshold=%.4f",
            self.val_metrics.auprc,
            self.val_metrics.f1,
            self.threshold,
        )
        return self

    def evaluate_test(
        self,
        X_test: np.ndarray,
        y_test: np.ndarray,
        fp_cost: float = 40.0,
        fn_cost: float = 200.0,
    ) -> EvaluationMetrics:
        """
        Evaluate on the held-out test set using the frozen validation threshold.

        MUST be called at most ONCE after all training and validation tuning
        is complete.  The threshold must already be set from fit().
        """
        if self.model is None:
            raise RuntimeError("Model has not been trained. Call fit() first.")

        X_test_s = self.scaler.transform(X_test) if self.scaler is not None else X_test
        test_probs = self.model.predict_proba(X_test_s)[:, 1]

        self.test_metrics = evaluate(
            y_test, test_probs,
            threshold=self.threshold,   # frozen from validation
            fp_cost=fp_cost,
            fn_cost=fn_cost,
            split_name="test",
        )
        logger.info(
            "Baseline TEST (held-out): AUPRC=%.4f F1=%.4f P=%.4f R=%.4f",
            self.test_metrics.auprc,
            self.test_metrics.f1,
            self.test_metrics.precision,
            self.test_metrics.recall,
        )
        return self.test_metrics

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        """Return fraud probabilities for feature matrix X."""
        if self.model is None:
            raise RuntimeError("Model not trained.")
        X_s = self.scaler.transform(X) if self.scaler is not None else X
        return self.model.predict_proba(X_s)[:, 1]

    # ── Persistence ───────────────────────────────────────────────────────

    def save(self, output_dir: Path | str) -> dict[str, Path]:
        """
        Save model artefacts to output_dir in the format expected by
        ModelRegistry (Milestone 10).

        Returns a dict of {name: path} for MLflow artifact logging.
        """
        out = Path(output_dir)
        out.mkdir(parents=True, exist_ok=True)

        artefacts: dict[str, Path] = {}

        # Save model as xgb_model.pkl (naming convention matches ModelRegistry)
        model_path = out / "xgb_model.pkl"
        with open(model_path, "wb") as f:
            pickle.dump(self.model, f)
        artefacts["xgb_model.pkl"] = model_path

        if self.scaler is not None:
            scaler_path = out / "scaler.pkl"
            with open(scaler_path, "wb") as f:
                pickle.dump(self.scaler, f)
            artefacts["scaler.pkl"] = scaler_path

        # Metadata
        from niro_ml.features.base import ALL_FEATURE_COLUMNS
        metadata = {
            "model_version":   "logistic-regression-baseline-v1",
            "algorithm":       "LogisticRegression",
            "feature_version": self.feature_version,
            "threshold":       self.threshold,
            "feature_names":   ALL_FEATURE_COLUMNS,
            "hyperparameters": self.hyperparams,
        }
        meta_path = out / "metadata.pkl"
        with open(meta_path, "wb") as f:
            pickle.dump(metadata, f)
        artefacts["metadata.pkl"] = meta_path

        logger.info("Baseline model saved to %s", out)
        return artefacts

    @classmethod
    def load(cls, model_dir: Path | str) -> "BaselineModel":
        out = Path(model_dir)
        with open(out / "xgb_model.pkl", "rb") as f:
            model = pickle.load(f)
        scaler = None
        if (out / "scaler.pkl").exists():
            with open(out / "scaler.pkl", "rb") as f:
                scaler = pickle.load(f)
        with open(out / "metadata.pkl", "rb") as f:
            meta = pickle.load(f)
        inst = cls(hyperparams=meta.get("hyperparameters"))
        inst.model     = model
        inst.scaler    = scaler
        inst.threshold = meta.get("threshold", 0.5)
        return inst

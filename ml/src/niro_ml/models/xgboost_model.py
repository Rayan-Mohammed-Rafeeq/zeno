"""
XGBoost primary fraud classifier.

WHY XGBOOST OVER LOGISTIC REGRESSION
──────────────────────────────────────
1. Handles non-linear feature interactions natively (velocity × amount,
   device-sharing × account-age, etc.).
2. Built-in scale_pos_weight for class imbalance.
3. Supports SHAP TreeExplainer — fast exact SHAP values.
4. Consistently outperforms linear models on tabular fraud data.
5. Gradient boosting is robust to outliers and missing values.

CLASS IMBALANCE HANDLING
─────────────────────────
We use scale_pos_weight = n_negative / n_positive on training data ONLY.
This is equivalent to upweighting the minority class without generating
synthetic samples (which could introduce artefacts near the decision
boundary).  The weight is computed from training labels — never from
validation or test labels.

PIPELINE OVERVIEW
──────────────────
1. Compute scale_pos_weight from y_train.
2. Train XGBoost with early stopping on validation AUPRC.
3. Sweep thresholds on validation to minimise expected_loss.
4. Persist: model, metadata (version, threshold, feature names).
"""

from __future__ import annotations

import logging
import pickle
from pathlib import Path
from typing import Any

import numpy as np
import xgboost as xgb
from sklearn.utils.class_weight import compute_sample_weight

from niro_ml.evaluation.metrics import EvaluationMetrics, evaluate, sweep_thresholds
from niro_ml.features.base import ALL_FEATURE_COLUMNS, FEATURE_VERSION

logger = logging.getLogger(__name__)

# ── Default hyperparameters (starting point — tuned in Milestone 4) ───────
DEFAULT_XGB_PARAMS: dict[str, Any] = {
    "objective":        "binary:logistic",
    "eval_metric":      "aucpr",          # AUPRC — primary metric
    "max_depth":        6,
    "learning_rate":    0.05,
    "n_estimators":     500,
    "subsample":        0.8,
    "colsample_bytree": 0.8,
    "min_child_weight": 5,
    "reg_alpha":        0.1,
    "reg_lambda":       1.0,
    "random_state":     42,
    "n_jobs":           -1,
    "tree_method":      "hist",           # fast histogram-based algorithm
    "early_stopping_rounds": 30,
}

MODEL_VERSION_PREFIX = "xgboost"


class XGBoostFraudModel:
    """
    XGBoost fraud classifier with threshold optimisation and persistence.

    The model is always evaluated with the same held-out methodology as
    the baseline — this is the only valid comparison.
    """

    def __init__(
        self,
        params: dict[str, Any] | None = None,
        model_version: str = "xgboost-v1",
    ) -> None:
        self.params        = {**DEFAULT_XGB_PARAMS, **(params or {})}
        self.model_version = model_version
        self.model: xgb.XGBClassifier | None = None
        self.threshold:     float = 0.5
        self.feature_version:     str = FEATURE_VERSION
        self.val_metrics:   EvaluationMetrics | None = None
        self.test_metrics:  EvaluationMetrics | None = None
        self._best_iteration: int = 0

    # ── Training ─────────────────────────────────────────────────────────

    def fit(
        self,
        X_train: np.ndarray,
        y_train: np.ndarray,
        X_val:   np.ndarray,
        y_val:   np.ndarray,
        fp_cost: float = 40.0,
        fn_cost: float = 200.0,
    ) -> "XGBoostFraudModel":
        """
        Train XGBoost and select threshold on validation data.

        scale_pos_weight is computed from y_train only.
        Early stopping uses validation AUPRC.
        Threshold is selected by minimum expected_loss on validation.
        """
        n_neg  = int((y_train == 0).sum())
        n_pos  = int((y_train == 1).sum())
        if n_pos == 0:
            raise ValueError("Training set has no positive (fraud) examples.")

        spw = n_neg / n_pos
        logger.info(
            "Training XGBoost: n_train=%d, n_val=%d, fraud_rate=%.4f, "
            "scale_pos_weight=%.2f",
            len(y_train), len(y_val), y_train.mean(), spw,
        )

        # Build params with scale_pos_weight computed from training data
        train_params = {**self.params, "scale_pos_weight": spw}
        # Remove sklearn-incompatible key before constructing
        early_stopping = train_params.pop("early_stopping_rounds", 30)

        self.model = xgb.XGBClassifier(
            **train_params,
            early_stopping_rounds=early_stopping,
        )
        self.model.fit(
            X_train, y_train.astype(int),
            eval_set=[(X_val, y_val.astype(int))],
            verbose=False,
        )
        self._best_iteration = getattr(self.model, "best_iteration", 0)
        logger.info("Training complete. Best iteration: %d", self._best_iteration)

        # Validation probabilities
        val_probs = self.model.predict_proba(X_val)[:, 1]

        # Threshold sweep on validation ONLY
        sweep = sweep_thresholds(y_val, val_probs, fp_cost=fp_cost, fn_cost=fn_cost)
        self.threshold = sweep.optimal_threshold

        # Full validation metrics
        self.val_metrics = evaluate(
            y_val, val_probs,
            threshold=self.threshold,
            fp_cost=fp_cost,
            fn_cost=fn_cost,
            split_name="validation",
        )
        logger.info(
            "XGBoost validation: AUPRC=%.4f F1=%.4f P=%.4f R=%.4f threshold=%.4f",
            self.val_metrics.auprc, self.val_metrics.f1,
            self.val_metrics.precision, self.val_metrics.recall,
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
        Evaluate on the held-out test set. Call ONCE after all tuning.
        Uses the frozen validation threshold.
        """
        if self.model is None:
            raise RuntimeError("Model not trained. Call fit() first.")
        test_probs = self.model.predict_proba(X_test)[:, 1]
        self.test_metrics = evaluate(
            y_test, test_probs,
            threshold=self.threshold,
            fp_cost=fp_cost,
            fn_cost=fn_cost,
            split_name="test",
        )
        logger.info(
            "XGBoost TEST (held-out): AUPRC=%.4f F1=%.4f P=%.4f R=%.4f",
            self.test_metrics.auprc, self.test_metrics.f1,
            self.test_metrics.precision, self.test_metrics.recall,
        )
        return self.test_metrics

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        if self.model is None:
            raise RuntimeError("Model not trained.")
        return self.model.predict_proba(X)[:, 1]

    def feature_importances(self) -> dict[str, float]:
        """Return feature importances by gain (most informative features)."""
        if self.model is None:
            raise RuntimeError("Model not trained.")
        imp = self.model.get_booster().get_score(importance_type="gain")
        # Map f0, f1, ... back to feature names
        names = ALL_FEATURE_COLUMNS
        named: dict[str, float] = {}
        for k, v in imp.items():
            try:
                idx = int(k[1:])
                named[names[idx]] = v
            except (ValueError, IndexError):
                named[k] = v
        return dict(sorted(named.items(), key=lambda x: x[1], reverse=True))

    # ── Persistence ───────────────────────────────────────────────────────

    def save(self, output_dir: Path | str) -> dict[str, Path]:
        """Save artefacts in ModelRegistry format."""
        out = Path(output_dir)
        out.mkdir(parents=True, exist_ok=True)

        artefacts: dict[str, Path] = {}

        model_path = out / "xgb_model.pkl"
        with open(model_path, "wb") as f:
            pickle.dump(self.model, f)
        artefacts["xgb_model.pkl"] = model_path

        metadata = {
            "model_version":   self.model_version,
            "algorithm":       "XGBoost",
            "feature_version": self.feature_version,
            "threshold":       self.threshold,
            "feature_names":   ALL_FEATURE_COLUMNS,
            "hyperparameters": self.params,
            "best_iteration":  self._best_iteration,
        }
        meta_path = out / "metadata.pkl"
        with open(meta_path, "wb") as f:
            pickle.dump(metadata, f)
        artefacts["metadata.pkl"] = meta_path

        logger.info("XGBoost model saved to %s", out)
        return artefacts

    @classmethod
    def load(cls, model_dir: Path | str) -> "XGBoostFraudModel":
        out = Path(model_dir)
        with open(out / "xgb_model.pkl", "rb") as f:
            model = pickle.load(f)
        with open(out / "metadata.pkl", "rb") as f:
            meta = pickle.load(f)
        inst = cls(params=meta.get("hyperparameters"), model_version=meta.get("model_version", "xgboost-v1"))
        inst.model     = model
        inst.threshold = meta.get("threshold", 0.5)
        inst._best_iteration = meta.get("best_iteration", 0)
        return inst

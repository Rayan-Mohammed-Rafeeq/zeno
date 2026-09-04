"""
XGBoost hyperparameter optimisation script.

METHODOLOGY
────────────
We use a manual grid/random search over meaningful parameter ranges,
evaluating each configuration on the VALIDATION set only.
The test set is never touched during this process.

We do NOT use exhaustive grid search — the search space is kept small
and principled to avoid overfitting the validation set through
excessive experimentation.

Parameters searched:
  max_depth:          [4, 6, 8]
  learning_rate:      [0.01, 0.05, 0.1]
  n_estimators:       [300, 500, 800]   (with early stopping, actual may be less)
  subsample:          [0.7, 0.8, 1.0]
  colsample_bytree:   [0.7, 0.8, 1.0]
  min_child_weight:   [3, 5, 10]
  reg_alpha:          [0.0, 0.1, 0.5]
  reg_lambda:         [0.5, 1.0, 2.0]

Primary optimisation metric: val_auprc (AUPRC on validation set).
Secondary: val_expected_loss (for business-cost awareness).

Every configuration is logged as a separate MLflow run under the
'zeno-fraud-detection' experiment.  The best run is identified by
val_auprc and its parameters are written to data/artifacts/best_params.pkl.

Usage
─────
    python scripts/tune_xgboost.py --synthetic --n-samples 8000
    python scripts/tune_xgboost.py --max-rows 50000
    python scripts/tune_xgboost.py --synthetic --n-samples 8000 --quick
        (quick mode: reduced search for CI/testing)
"""

from __future__ import annotations

import argparse
import itertools
import logging
import pickle
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))

import mlflow
import numpy as np
import pandas as pd

from zeno_ml.evaluation.metrics import sweep_thresholds
from zeno_ml.features.base import FEATURE_VERSION
from zeno_ml.models.splits import compute_fraud_rates, temporal_split, temporal_split_labels
from zeno_ml.models.xgboost_model import XGBoostFraudModel
from zeno_ml.scripts_common import build_feature_matrix, load_dataset

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger("tune_xgboost")

# ── Full search grid ──────────────────────────────────────────────────────
FULL_GRID: dict[str, list] = {
    "max_depth":        [4, 6, 8],
    "learning_rate":    [0.01, 0.05, 0.1],
    "n_estimators":     [300, 500, 800],
    "subsample":        [0.7, 0.8, 1.0],
    "colsample_bytree": [0.7, 0.8, 1.0],
    "min_child_weight": [3, 5, 10],
    "reg_alpha":        [0.0, 0.1, 0.5],
    "reg_lambda":       [0.5, 1.0, 2.0],
}

# Reduced grid for quick mode (CI / fast iteration)
QUICK_GRID: dict[str, list] = {
    "max_depth":        [4, 6],
    "learning_rate":    [0.05, 0.1],
    "n_estimators":     [200, 400],
    "subsample":        [0.8],
    "colsample_bytree": [0.8],
    "min_child_weight": [3, 5],
    "reg_alpha":        [0.0, 0.1],
    "reg_lambda":       [1.0],
}

FIXED_PARAMS: dict[str, Any] = {
    "objective":            "binary:logistic",
    "eval_metric":          "aucpr",
    "random_state":         42,
    "n_jobs":               -1,
    "tree_method":          "hist",
    "early_stopping_rounds": 30,
}


def _grid_configs(grid: dict[str, list], max_configs: int) -> list[dict[str, Any]]:
    """Generate all combinations, capped at max_configs (random sample if over)."""
    keys   = list(grid.keys())
    values = list(grid.values())
    all_configs = [
        dict(zip(keys, combo))
        for combo in itertools.product(*values)
    ]
    if len(all_configs) <= max_configs:
        return all_configs
    rng = np.random.default_rng(0)
    idxs = rng.choice(len(all_configs), size=max_configs, replace=False)
    return [all_configs[i] for i in sorted(idxs)]


def tune(args: argparse.Namespace) -> None:
    mlflow_uri = f"file:///{(ROOT / 'mlruns').as_posix()}"
    mlflow.set_tracking_uri(mlflow_uri)
    mlflow.set_experiment("zeno-fraud-detection")

    artifacts_dir = ROOT / "data" / "artifacts"
    artifacts_dir.mkdir(parents=True, exist_ok=True)

    # ── Load + split + features (done ONCE, reused across all configs) ────
    df, labels, dataset_meta = load_dataset(args)
    split = temporal_split(df, order_column="transaction_dt",
                           metadata={"dataset": dataset_meta["dataset_name"]})
    logger.info(split.summary())
    df_train, df_val, df_test = split.apply(df)
    y_train_s, y_val_s, _    = temporal_split_labels(labels, split)

    X_train, y_train, scaler = build_feature_matrix(df_train, pd.Series(y_train_s), fit_scaler=True)
    X_val,   y_val,   _      = build_feature_matrix(df_val,   pd.Series(y_val_s),   scaler=scaler)

    logger.info("Feature shapes: train=%s val=%s", X_train.shape, X_val.shape)
    logger.info("Fraud rates: train=%.4f val=%.4f", y_train.mean(), y_val.mean())

    grid    = QUICK_GRID if args.quick else FULL_GRID
    configs = _grid_configs(grid, max_configs=args.max_configs)
    logger.info("Running %d hyperparameter configurations…", len(configs))

    results: list[dict[str, Any]] = []

    for i, cfg in enumerate(configs):
        params = {**FIXED_PARAMS, **cfg}
        run_name = f"xgb-tune-{i:03d}"
        logger.info("[%d/%d] %s", i + 1, len(configs), cfg)

        with mlflow.start_run(run_name=run_name, nested=False) as run:
            mlflow.log_params({
                "algorithm":          "XGBoost",
                "tuning_run":         i,
                "feature_version":    FEATURE_VERSION,
                "dataset":            dataset_meta["dataset_name"],
                "is_synthetic":       dataset_meta["is_synthetic"],
                **{f"xgb_{k}": v for k, v in cfg.items()},
            })

            try:
                model = XGBoostFraudModel(params=params, model_version=f"xgb-tune-{i}")
                model.fit(X_train, y_train, X_val, y_val,
                          fp_cost=args.fp_cost, fn_cost=args.fn_cost)

                vm = model.val_metrics
                mlflow.log_metrics({
                    "val_auprc":     round(vm.auprc, 4),
                    "val_f1":        round(vm.f1, 4),
                    "val_precision": round(vm.precision, 4),
                    "val_recall":    round(vm.recall, 4),
                    "val_roc_auc":   round(vm.roc_auc, 4),
                    "val_expected_loss": round(vm.expected_loss, 2),
                    "val_threshold": round(model.threshold, 4),
                })

                results.append({
                    "run_id":   run.info.run_id,
                    "config":   cfg,
                    "val_auprc": vm.auprc,
                    "val_f1":   vm.f1,
                    "val_expected_loss": vm.expected_loss,
                    "threshold": model.threshold,
                })

            except Exception as exc:  # noqa: BLE001
                logger.warning("Config %d failed: %s", i, exc)
                mlflow.log_param("error", str(exc))

    if not results:
        logger.error("All configurations failed.")
        return

    # ── Select best by AUPRC ──────────────────────────────────────────────
    best = max(results, key=lambda r: r["val_auprc"])
    logger.info(
        "\nBest config (val_auprc=%.4f, val_f1=%.4f, expected_loss=%.0f):\n%s",
        best["val_auprc"], best["val_f1"], best["val_expected_loss"],
        best["config"],
    )

    # Save best params
    best_params_path = artifacts_dir / "best_xgb_params.pkl"
    best_payload = {
        "best_config":    best["config"],
        "best_run_id":    best["run_id"],
        "val_auprc":      best["val_auprc"],
        "val_f1":         best["val_f1"],
        "threshold":      best["threshold"],
        "all_results":    results,
        "feature_version": FEATURE_VERSION,
        "dataset":        dataset_meta["dataset_name"],
        "test_fingerprint": split.test_fingerprint,
    }
    with open(best_params_path, "wb") as f:
        pickle.dump(best_payload, f)

    logger.info("Best params saved to %s", best_params_path)
    logger.info("MLflow UI: mlflow ui --backend-store-uri %s", mlflow_uri)

    # Print summary table
    results.sort(key=lambda r: r["val_auprc"], reverse=True)
    print(f"\n{'Rank':<5} {'AUPRC':>8} {'F1':>8} {'Exp Loss':>12}  Config")
    print("-" * 70)
    for rank, r in enumerate(results[:10], 1):
        print(f"{rank:<5} {r['val_auprc']:>8.4f} {r['val_f1']:>8.4f} "
              f"{r['val_expected_loss']:>12.0f}  {r['config']}")


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Hyperparameter optimisation for XGBoost")
    p.add_argument("--synthetic",   action="store_true")
    p.add_argument("--n-samples",   type=int,   default=8000)
    p.add_argument("--max-rows",    type=int,   default=None)
    p.add_argument("--fp-cost",     type=float, default=40.0)
    p.add_argument("--fn-cost",     type=float, default=200.0)
    p.add_argument("--max-configs", type=int,   default=20,
                   help="Max configurations to evaluate (default 20)")
    p.add_argument("--quick",       action="store_true",
                   help="Use reduced search grid (CI/testing)")
    return p.parse_args()


if __name__ == "__main__":
    tune(_parse_args())

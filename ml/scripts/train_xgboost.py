"""
XGBoost primary model training script.

Usage
─────
    python scripts/train_xgboost.py --synthetic --n-samples 8000
    python scripts/train_xgboost.py --max-rows 100000

What this script does
─────────────────────
1. Load dataset (IEEE-CIS or synthetic).
2. Temporal split 70/15/15.
3. Feature pipeline on each split (scaler fit on train only).
4. Train XGBoost with scale_pos_weight + early stopping on val AUPRC.
5. Sweep thresholds on validation → freeze optimal threshold.
6. Log all params + metrics to MLflow experiment 'niro-fraud-detection'.
7. Evaluate ONCE on held-out test set.
8. Compare against baseline from previous run (logged as tags).
9. Save artefacts + benchmark report.

Options
───────
  --synthetic       Use synthetic data
  --n-samples INT   Synthetic dataset size (default 8000)
  --max-rows INT    Limit IEEE-CIS rows
  --fp-cost FLOAT   FP cost USD (default 40)
  --fn-cost FLOAT   FN cost USD (default 200)
  --output-dir PATH Artefact directory
  --no-test         Skip test evaluation (dev mode)
"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))

import mlflow
import numpy as np
import pandas as pd

from niro_ml.evaluation.report import BenchmarkReport, ModelEntry
from niro_ml.features.base import FEATURE_VERSION
from niro_ml.models.calibration import evaluate_calibration, save_calibrator
from niro_ml.models.splits import compute_fraud_rates, temporal_split, temporal_split_labels
from niro_ml.models.xgboost_model import DEFAULT_XGB_PARAMS, XGBoostFraudModel
from niro_ml.scripts_common import build_feature_matrix, load_dataset

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger("train_xgboost")


def train(args: argparse.Namespace) -> None:
    mlflow_uri = f"file:///{(ROOT / 'mlruns').as_posix()}"
    mlflow.set_tracking_uri(mlflow_uri)
    mlflow.set_experiment("niro-fraud-detection")

    output_dir = Path(args.output_dir or ROOT / "data" / "artifacts" / "xgboost")
    report_dir = ROOT / "reports"
    report_dir.mkdir(exist_ok=True)

    # ── 1. Load ───────────────────────────────────────────────────────────
    df, labels, dataset_meta = load_dataset(args)

    # ── 2. Split ──────────────────────────────────────────────────────────
    split = temporal_split(df, order_column="transaction_dt",
                           metadata={"dataset": dataset_meta["name"]})
    logger.info(split.summary())
    df_train, df_val, df_test = split.apply(df)
    y_train, y_val, y_test    = temporal_split_labels(labels, split)
    fraud_rates               = compute_fraud_rates(y_train, y_val, y_test)

    # ── 3. Features ───────────────────────────────────────────────────────
    X_train, y_train, scaler = build_feature_matrix(df_train, pd.Series(y_train), fit_scaler=True)
    X_val,   y_val,   _      = build_feature_matrix(df_val,   pd.Series(y_val),   scaler=scaler)
    X_test,  y_test,  _      = build_feature_matrix(df_test,  pd.Series(y_test),  scaler=scaler)
    logger.info("Shapes: train=%s val=%s test=%s", X_train.shape, X_val.shape, X_test.shape)

    # ── 4–8. Train + evaluate ─────────────────────────────────────────────
    with mlflow.start_run(run_name="xgboost-v1") as run:
        logger.info("MLflow run: %s", run.info.run_id)

        mlflow.log_params({
            "algorithm":          "XGBoost",
            "feature_version":    FEATURE_VERSION,
            "dataset":            dataset_meta["name"],
            "is_synthetic":       dataset_meta["is_synthetic"],
            "n_train":            len(X_train),
            "n_val":              len(X_val),
            "n_test":             len(X_test),
            "train_fraud_rate":   round(float(y_train.mean()), 6),
            "test_fingerprint":   split.test_fingerprint[:16],
            **{f"xgb_{k}": v for k, v in DEFAULT_XGB_PARAMS.items()
               if k not in ("random_state", "n_jobs")},
        })

        model = XGBoostFraudModel()
        model.fit(X_train, y_train, X_val, y_val,
                  fp_cost=args.fp_cost, fn_cost=args.fn_cost)

        vm = model.val_metrics
        mlflow.log_metrics({
            "val_precision": round(vm.precision, 4),
            "val_recall":    round(vm.recall, 4),
            "val_f1":        round(vm.f1, 4),
            "val_auprc":     round(vm.auprc, 4),
            "val_roc_auc":   round(vm.roc_auc, 4),
            "val_fpr":       round(vm.fpr, 4),
            "val_expected_loss": round(vm.expected_loss, 2),
            "val_threshold": round(model.threshold, 4),
        })

        # ── Calibration (on second half of val set) ───────────────────────
        val_probs = model.predict_proba(X_val)
        n_cal     = len(y_val) // 2
        cal_result = evaluate_calibration(y_val[n_cal:], val_probs[n_cal:])
        mlflow.log_metrics({
            "cal_ece_before":  round(cal_result.before_ece, 4),
            "cal_ece_after":   round(cal_result.after_ece, 4),
            "cal_improvement": round(cal_result.improvement, 4),
        })
        mlflow.log_param("cal_method", cal_result.method)

        # Save calibrator if it helped
        if cal_result.calibrator is not None:
            cal_path = output_dir / "calibrator.pkl"
            save_calibrator(cal_result.calibrator, cal_path)
            mlflow.log_artifact(str(cal_path), artifact_path="model")

        test_metrics = None
        if not args.no_test:
            test_metrics = model.evaluate_test(X_test, y_test,
                                               fp_cost=args.fp_cost, fn_cost=args.fn_cost)
            tm = test_metrics
            mlflow.log_metrics({
                "test_precision": round(tm.precision, 4),
                "test_recall":    round(tm.recall, 4),
                "test_f1":        round(tm.f1, 4),
                "test_auprc":     round(tm.auprc, 4),
                "test_roc_auc":   round(tm.roc_auc, 4),
                "test_fpr":       round(tm.fpr, 4),
                "test_expected_loss": round(tm.expected_loss, 2),
            })

        artefact_paths = model.save(output_dir)
        for name, path in artefact_paths.items():
            mlflow.log_artifact(str(path), artifact_path="model")

        report = BenchmarkReport(
            **dataset_meta,
            n_train=split.n_train, n_val=split.n_val, n_test=split.n_test,
            train_fraud_rate=fraud_rates["train_fraud_rate"],
            val_fraud_rate=fraud_rates["val_fraud_rate"],
            test_fraud_rate=fraud_rates["test_fraud_rate"],
            order_column="transaction_dt",
            test_fingerprint=split.test_fingerprint,
            fp_cost=args.fp_cost, fn_cost=args.fn_cost,
            models=[ModelEntry(
                name="XGBoost-v1",
                algorithm="XGBoost",
                feature_version=FEATURE_VERSION,
                feature_groups=["transaction", "behavioral", "device_ip", "sequence"],
                hyperparameters=DEFAULT_XGB_PARAMS,
                threshold=model.threshold,
                val_metrics=vm,
                test_metrics=test_metrics,
                notes=f"scale_pos_weight=auto, early_stopping={DEFAULT_XGB_PARAMS['early_stopping_rounds']}",
            )],
        )
        json_path, _ = report.save(report_dir)
        mlflow.log_artifact(str(json_path), artifact_path="reports")

        logger.info("\n%s", report.to_text())
        logger.info("MLflow run %s complete.", run.info.run_id)

    print(f"\n✓ XGBoost training complete.\n  Report: {json_path}")


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Train XGBoost fraud classifier")
    p.add_argument("--synthetic",  action="store_true")
    p.add_argument("--n-samples",  type=int,   default=8000)
    p.add_argument("--max-rows",   type=int,   default=None)
    p.add_argument("--fp-cost",    type=float, default=40.0)
    p.add_argument("--fn-cost",    type=float, default=200.0)
    p.add_argument("--output-dir", type=str,   default=None)
    p.add_argument("--no-test",    action="store_true")
    return p.parse_args()


if __name__ == "__main__":
    train(_parse_args())

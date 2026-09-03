"""
Full Niro ML pipeline — runs all training steps in sequence.

This is the single entry point for a complete training run:
  1. Load dataset (IEEE-CIS or synthetic)
  2. Temporal split 70/15/15
  3. Feature pipeline (scaler fit on train)
  4. Train Logistic Regression baseline
  5. Train Isolation Forest anomaly detector
  6. Train XGBoost with scale_pos_weight + early stopping
  7. Evaluate calibration (Platt vs isotonic) on val
  8. Threshold optimisation on validation data
  9. Run ablation study (5 steps)
  10. Final evaluation on held-out test set (ONCE)
  11. Save all artefacts + ModelRegistry metadata.pkl
  12. Generate full benchmark report + ablation report
  13. Log everything to MLflow (parent run with nested children)

The test set is evaluated exactly once — at step 10 — after all
design decisions (hyperparameters, features, threshold) are frozen.

Usage
─────
    python scripts/train_full_pipeline.py --synthetic --n-samples 8000
    python scripts/train_full_pipeline.py --max-rows 200000
    python scripts/train_full_pipeline.py --synthetic --n-samples 8000 --skip-ablation

Options
───────
  --synthetic         Use synthetic data
  --n-samples INT     Synthetic dataset size (default 8000)
  --max-rows INT      Limit IEEE-CIS rows
  --fp-cost FLOAT     FP cost USD (default 40)
  --fn-cost FLOAT     FN cost USD (default 200)
  --output-dir PATH   Artefact output directory
  --skip-ablation     Skip ablation study (faster, for quick iteration)
  --no-test           Skip test evaluation (development mode)
"""

from __future__ import annotations

import argparse
import json
import logging
import pickle
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))

import mlflow
import numpy as np
import pandas as pd

from niro_ml.evaluation.metrics import evaluate
from niro_ml.evaluation.report import BenchmarkReport, ModelEntry
from niro_ml.evaluation.threshold import ThresholdOptimizer
from niro_ml.features.base import ALL_FEATURE_COLUMNS, FEATURE_VERSION, GRAPH_FEATURES
from niro_ml.inference.aggregator import normalize_anomaly_score
from niro_ml.models.baseline import BaselineModel
from niro_ml.models.calibration import evaluate_calibration, save_calibrator
from niro_ml.models.isolation_forest import AnomalyDetector
from niro_ml.models.splits import compute_fraud_rates, temporal_split, temporal_split_labels
from niro_ml.models.xgboost_model import DEFAULT_XGB_PARAMS, XGBoostFraudModel
from niro_ml.scripts_common import build_feature_matrix, load_dataset

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger("train_full_pipeline")


def run(args: argparse.Namespace) -> None:  # noqa: C901  (acceptable length for pipeline)
    mlflow_uri = f"file:///{(ROOT / 'mlruns').as_posix()}"
    mlflow.set_tracking_uri(mlflow_uri)
    mlflow.set_experiment("niro-fraud-detection")

    output_dir = Path(args.output_dir or ROOT / "data" / "artifacts" / "xgboost")
    output_dir.mkdir(parents=True, exist_ok=True)
    report_dir = ROOT / "reports"
    report_dir.mkdir(exist_ok=True)

    # ── Step 1: Load ──────────────────────────────────────────────────────
    logger.info("=" * 60)
    logger.info("STEP 1/12 — Load dataset")
    df, labels, dataset_meta = load_dataset(args)

    # ── Step 2: Split ─────────────────────────────────────────────────────
    logger.info("STEP 2/12 — Temporal split")
    split = temporal_split(
        df, order_column="transaction_dt",
        metadata={"dataset": dataset_meta["dataset_name"]},
    )
    logger.info(split.summary())
    df_train, df_val, df_test = split.apply(df)
    y_tr_s, y_va_s, y_te_s   = temporal_split_labels(labels, split)
    fraud_rates               = compute_fraud_rates(y_tr_s, y_va_s, y_te_s)
    logger.info("Fraud rates: %s", fraud_rates)

    # ── Step 3: Feature pipeline ──────────────────────────────────────────
    logger.info("STEP 3/12 — Feature pipeline")
    X_train, y_train, scaler = build_feature_matrix(
        df_train, pd.Series(y_tr_s), fit_scaler=True
    )
    X_val,   y_val,   _      = build_feature_matrix(
        df_val,  pd.Series(y_va_s), scaler=scaler
    )
    X_test,  y_test,  _      = build_feature_matrix(
        df_test, pd.Series(y_te_s), scaler=scaler
    )
    logger.info(
        "Feature shapes: train=%s  val=%s  test=%s",
        X_train.shape, X_val.shape, X_test.shape,
    )

    # ── Parent MLflow run ─────────────────────────────────────────────────
    with mlflow.start_run(run_name="full-pipeline") as parent_run:
        mlflow.log_params({
            "pipeline_version":  "1.0",
            "feature_version":   FEATURE_VERSION,
            "dataset":           dataset_meta["dataset_name"],
            "is_synthetic":      dataset_meta["is_synthetic"],
            "n_train":           len(X_train),
            "n_val":             len(X_val),
            "n_test":            len(X_test),
            "train_fraud_rate":  round(float(y_train.mean()), 6),
            "test_fingerprint":  split.test_fingerprint[:16],
            "fp_cost":           args.fp_cost,
            "fn_cost":           args.fn_cost,
        })

        # ── Step 4: Logistic Regression baseline ──────────────────────────
        logger.info("STEP 4/12 — Logistic Regression baseline")
        with mlflow.start_run(run_name="baseline-lr", nested=True):
            baseline = BaselineModel()
            baseline.fit(
                X_train, y_train, X_val, y_val,
                fp_cost=args.fp_cost, fn_cost=args.fn_cost,
                fit_scaler=False,
            )
            bvm = baseline.val_metrics
            mlflow.log_metrics({
                "val_auprc":   round(bvm.auprc, 4),
                "val_f1":      round(bvm.f1,    4),
                "val_roc_auc": round(bvm.roc_auc, 4),
            })
            mlflow.log_param("algorithm", "LogisticRegression")

        # ── Step 5: Isolation Forest ──────────────────────────────────────
        logger.info("STEP 5/12 — Isolation Forest anomaly detector")
        with mlflow.start_run(run_name="isolation-forest", nested=True):
            detector = AnomalyDetector()
            detector.fit(X_train, y_train, feature_names=ALL_FEATURE_COLUMNS)
            if_val_stats = detector.validate(X_val, y_val)
            mlflow.log_metrics({k: round(v, 4) for k, v in if_val_stats.items()})
            mlflow.log_param("algorithm", "IsolationForest")
            detector.save(output_dir)

        # ── Step 6: XGBoost ───────────────────────────────────────────────
        logger.info("STEP 6/12 — XGBoost primary model")
        with mlflow.start_run(run_name="xgboost-primary", nested=True):
            xgb_model = XGBoostFraudModel()
            xgb_model.fit(
                X_train, y_train, X_val, y_val,
                fp_cost=args.fp_cost, fn_cost=args.fn_cost,
            )
            xvm = xgb_model.val_metrics
            mlflow.log_metrics({
                "val_auprc":     round(xvm.auprc,     4),
                "val_f1":        round(xvm.f1,        4),
                "val_precision": round(xvm.precision, 4),
                "val_recall":    round(xvm.recall,    4),
                "val_roc_auc":   round(xvm.roc_auc,   4),
                "val_fpr":       round(xvm.fpr,       4),
                "val_expected_loss": round(xvm.expected_loss, 2),
            })
            mlflow.log_param("algorithm", "XGBoost")

        # ── Step 7: Calibration ───────────────────────────────────────────
        logger.info("STEP 7/12 — Probability calibration")
        with mlflow.start_run(run_name="calibration", nested=True):
            val_probs_raw = xgb_model.predict_proba(X_val)
            n_cal         = len(y_val) // 2
            cal_result    = evaluate_calibration(y_val[n_cal:], val_probs_raw[n_cal:])
            mlflow.log_params({
                "cal_method":      cal_result.method,
                "cal_ece_before":  round(cal_result.before_ece, 4),
                "cal_ece_after":   round(cal_result.after_ece,  4),
                "cal_improvement": round(cal_result.improvement, 4),
            })
            if cal_result.calibrator is not None:
                cal_path = output_dir / "calibrator.pkl"
                save_calibrator(cal_result.calibrator, cal_path)
                mlflow.log_artifact(str(cal_path), artifact_path="model")
                logger.info(
                    "Calibration applied (%s): ECE %.4f → %.4f",
                    cal_result.method, cal_result.before_ece, cal_result.after_ece,
                )
            else:
                logger.info("Calibration did not improve ECE — keeping raw probs.")

        # ── Step 8: Threshold optimization ───────────────────────────────
        logger.info("STEP 8/12 — Threshold optimization on validation data")
        with mlflow.start_run(run_name="threshold-optimization", nested=True):
            optimizer     = ThresholdOptimizer(fp_cost=args.fp_cost, fn_cost=args.fn_cost)
            thresh_result = optimizer.optimize(y_val, val_probs_raw)
            # Freeze threshold from validation
            final_threshold = thresh_result.optimal_threshold
            mlflow.log_metrics({
                "optimal_threshold":         round(final_threshold, 4),
                "val_precision_at_threshold": round(thresh_result.val_metrics.precision, 4),
                "val_recall_at_threshold":    round(thresh_result.val_metrics.recall, 4),
                "val_f1_at_threshold":        round(thresh_result.val_metrics.f1, 4),
                "val_expected_loss":          round(thresh_result.val_metrics.expected_loss, 2),
            })
            logger.info(thresh_result.summary())

            # Save threshold curve for frontend charts
            curve_path = output_dir / "threshold_curve.json"
            curve_path.write_text(
                json.dumps(thresh_result.sweep.to_records(), indent=2),
                encoding="utf-8",
            )
            mlflow.log_artifact(str(curve_path), artifact_path="evaluation")

        # Update model threshold to the optimized value
        xgb_model.threshold = final_threshold

        # ── Step 9: Ablation study ────────────────────────────────────────
        ablation_rows: list[dict] = []
        if not args.skip_ablation:
            logger.info("STEP 9/12 — Ablation study")
            ablation_rows = _run_ablation_nested(
                X_train, y_train, X_val, y_val,
                detector, args,
            )
            _log_ablation_to_mlflow(ablation_rows, report_dir)
        else:
            logger.info("STEP 9/12 — Ablation skipped (--skip-ablation)")

        # ── Step 10: FINAL TEST EVALUATION (once, frozen threshold) ──────
        test_metrics_xgb  = None
        test_metrics_base = None

        if not args.no_test:
            logger.info("STEP 10/12 — FINAL held-out test evaluation")
            logger.info(
                "Using frozen threshold: %.4f (set on validation data)",
                final_threshold,
            )

            test_metrics_xgb  = xgb_model.evaluate_test(
                X_test, y_test,
                fp_cost=args.fp_cost, fn_cost=args.fn_cost,
            )
            test_metrics_base = baseline.evaluate_test(
                X_test, y_test,
                fp_cost=args.fp_cost, fn_cost=args.fn_cost,
            )

            mlflow.log_metrics({
                "test_precision":     round(test_metrics_xgb.precision, 4),
                "test_recall":        round(test_metrics_xgb.recall,    4),
                "test_f1":            round(test_metrics_xgb.f1,        4),
                "test_auprc":         round(test_metrics_xgb.auprc,     4),
                "test_roc_auc":       round(test_metrics_xgb.roc_auc,   4),
                "test_fpr":           round(test_metrics_xgb.fpr,       4),
                "test_expected_loss": round(test_metrics_xgb.expected_loss, 2),
                "baseline_test_auprc": round(test_metrics_base.auprc,   4),
                "xgb_vs_baseline_auprc_delta": round(
                    test_metrics_xgb.auprc - test_metrics_base.auprc, 4
                ),
            })
        else:
            logger.info("STEP 10/12 — Test evaluation skipped (--no-test)")

        # ── Step 11: Save artefacts ───────────────────────────────────────
        logger.info("STEP 11/12 — Save artefacts")
        xgb_artefacts = xgb_model.save(output_dir)

        # Save scaler alongside model artefacts
        scaler_path = output_dir / "scaler.pkl"
        with open(scaler_path, "wb") as f:
            pickle.dump(scaler, f)

        # Overwrite metadata with final threshold + feature_version
        meta = {
            "model_version":   "xgboost-v1",
            "algorithm":       "XGBoost",
            "feature_version": FEATURE_VERSION,
            "threshold":       final_threshold,
            "feature_names":   ALL_FEATURE_COLUMNS,
            "hyperparameters": DEFAULT_XGB_PARAMS,
        }
        with open(output_dir / "metadata.pkl", "wb") as f:
            pickle.dump(meta, f)

        for path in [scaler_path, output_dir / "metadata.pkl"]:
            mlflow.log_artifact(str(path), artifact_path="model")

        # ── Step 12: Benchmark report ─────────────────────────────────────
        logger.info("STEP 12/12 — Benchmark report")
        report = BenchmarkReport(
            **dataset_meta,
            n_train=split.n_train, n_val=split.n_val, n_test=split.n_test,
            train_fraud_rate=fraud_rates["train_fraud_rate"],
            val_fraud_rate=fraud_rates["val_fraud_rate"],
            test_fraud_rate=fraud_rates["test_fraud_rate"],
            order_column="transaction_dt",
            test_fingerprint=split.test_fingerprint,
            fp_cost=args.fp_cost, fn_cost=args.fn_cost,
            ablation_results=ablation_rows,
            models=[
                ModelEntry(
                    name="LogisticRegression-baseline",
                    algorithm="LogisticRegression",
                    feature_version=FEATURE_VERSION,
                    feature_groups=["transaction", "behavioral", "device_ip", "sequence"],
                    hyperparameters={"class_weight": "balanced", "C": 1.0},
                    threshold=baseline.threshold,
                    val_metrics=bvm,
                    test_metrics=test_metrics_base,
                    notes="Baseline — class_weight=balanced, StandardScaler.",
                ),
                ModelEntry(
                    name="XGBoost-v1",
                    algorithm="XGBoost",
                    feature_version=FEATURE_VERSION,
                    feature_groups=["transaction", "behavioral", "device_ip", "sequence"],
                    hyperparameters=DEFAULT_XGB_PARAMS,
                    threshold=final_threshold,
                    val_metrics=xvm,
                    test_metrics=test_metrics_xgb,
                    notes=(
                        f"scale_pos_weight=auto, early_stopping=30, "
                        f"calibration={cal_result.method}"
                    ),
                ),
            ],
        )
        json_path, txt_path = report.save(report_dir)
        mlflow.log_artifact(str(json_path), artifact_path="reports")
        mlflow.log_artifact(str(txt_path),  artifact_path="reports")

        logger.info("\n%s", report.to_text())
        logger.info("MLflow parent run: %s", parent_run.info.run_id)

    # Final summary
    print("\n" + "=" * 60)
    print("✓  FULL PIPELINE COMPLETE")
    print("=" * 60)
    print(f"   Artefacts  : {output_dir}")
    print(f"   Report     : {json_path}")
    print(f"   MLflow UI  : mlflow ui --backend-store-uri {mlflow_uri}")
    if not args.no_test and test_metrics_xgb:
        print(f"\n   XGBoost TEST results (held-out, evaluated once):")
        print(f"     AUPRC    : {test_metrics_xgb.auprc:.4f}")
        print(f"     F1       : {test_metrics_xgb.f1:.4f}")
        print(f"     Precision: {test_metrics_xgb.precision:.4f}")
        print(f"     Recall   : {test_metrics_xgb.recall:.4f}")
        print(f"     Exp Loss : ${test_metrics_xgb.expected_loss:,.0f}  [MODEL ESTIMATE]")
        if test_metrics_base:
            delta = test_metrics_xgb.auprc - test_metrics_base.auprc
            print(f"\n   vs Baseline AUPRC: {test_metrics_base.auprc:.4f}  "
                  f"(XGBoost delta: {'+' if delta >= 0 else ''}{delta:.4f})")
    print()


# ── Ablation helper (nested inside parent run) ────────────────────────────

def _run_ablation_nested(
    X_train:  "np.ndarray",
    y_train:  "np.ndarray",
    X_val:    "np.ndarray",
    y_val:    "np.ndarray",
    detector: "AnomalyDetector",
    args:     argparse.Namespace,
) -> list[dict]:
    from niro_ml.features.base import (
        TRANSACTION_FEATURES, BEHAVIORAL_FEATURES,
        DEVICE_IP_FEATURES, SEQUENCE_FEATURES,
    )

    # Inject anomaly score as extra feature
    train_anom = np.array([normalize_anomaly_score(s) for s in detector.score(X_train)])
    val_anom   = np.array([normalize_anomaly_score(s) for s in detector.score(X_val)])
    X_tr_aug   = np.hstack([X_train, train_anom.reshape(-1, 1)])
    X_va_aug   = np.hstack([X_val,   val_anom.reshape(-1, 1)])
    aug_cols    = ALL_FEATURE_COLUMNS + ["anomaly_score_feature"]

    steps = [
        ("ablation-1-transaction",   TRANSACTION_FEATURES),
        ("ablation-2-behavioral",    TRANSACTION_FEATURES + BEHAVIORAL_FEATURES),
        ("ablation-3-device-ip",     TRANSACTION_FEATURES + BEHAVIORAL_FEATURES + DEVICE_IP_FEATURES),
        ("ablation-4-sequence",      ALL_FEATURE_COLUMNS),
        ("ablation-5-anomaly",       aug_cols),
    ]

    rows = []
    step_names = [
        "baseline (transaction only)",
        "+ behavioral",
        "+ device/IP",
        "+ sequence",
        "+ anomaly score",
    ]

    for (run_name, keep_cols), label in zip(steps, step_names):
        actual_cols = [c for c in keep_cols if c in aug_cols]
        col_idx     = [i for i, c in enumerate(aug_cols) if c in actual_cols]
        X_tr = X_tr_aug[:, col_idx]
        X_va = X_va_aug[:, col_idx]

        with mlflow.start_run(run_name=run_name, nested=True):
            try:
                m = XGBoostFraudModel(model_version=run_name)
                m.fit(X_tr, y_train, X_va, y_val,
                      fp_cost=args.fp_cost, fn_cost=args.fn_cost)
                vm = m.val_metrics
                mlflow.log_metrics({
                    "val_auprc":         round(vm.auprc, 4),
                    "val_f1":            round(vm.f1,    4),
                    "val_expected_loss": round(vm.expected_loss, 2),
                })
                mlflow.log_param("ablation_step", label)
                rows.append({
                    "model":             label,
                    "n_features":        X_tr.shape[1],
                    "val_auprc":         round(vm.auprc, 4),
                    "val_f1":            round(vm.f1,    4),
                    "val_precision":     round(vm.precision, 4),
                    "val_recall":        round(vm.recall, 4),
                    "val_expected_loss": round(vm.expected_loss, 2),
                })
            except Exception as exc:   # noqa: BLE001
                logger.error("Ablation step '%s' failed: %s", label, exc)
                mlflow.log_param("error", str(exc))
    return rows


def _log_ablation_to_mlflow(rows: list[dict], report_dir: Path) -> None:
    if not rows:
        return
    ts   = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    path = report_dir / f"ablation_{ts}.json"
    path.write_text(json.dumps({"ablation": rows}, indent=2), encoding="utf-8")
    mlflow.log_artifact(str(path), artifact_path="reports")
    logger.info("Ablation saved: %s", path)

    # Print table
    print(f"\n{'Model':<45} {'AUPRC':>8} {'F1':>8} {'Exp Loss':>12}")
    print("-" * 76)
    prev = None
    for r in rows:
        delta = ""
        if prev is not None:
            d = r["val_auprc"] - prev
            delta = f" ({'+' if d >= 0 else ''}{d:.4f})"
        print(f"{r['model']:<45} {r['val_auprc']:>8.4f}{delta:<12} "
              f"{r['val_f1']:>8.4f} {r['val_expected_loss']:>12,.0f}")
        prev = r["val_auprc"]
    print()


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Full Niro ML training pipeline")
    p.add_argument("--synthetic",      action="store_true")
    p.add_argument("--n-samples",      type=int,   default=8000)
    p.add_argument("--max-rows",       type=int,   default=None)
    p.add_argument("--fp-cost",        type=float, default=40.0)
    p.add_argument("--fn-cost",        type=float, default=200.0)
    p.add_argument("--output-dir",     type=str,   default=None)
    p.add_argument("--skip-ablation",  action="store_true")
    p.add_argument("--no-test",        action="store_true")
    return p.parse_args()


if __name__ == "__main__":
    run(_parse_args())

"""
Ablation study — measures the incremental value of each feature group.

METHODOLOGY
────────────
We train one XGBoost model per feature configuration, keeping all other
settings constant (same hyperparameters, same data split, same random seed).
Each step ADDS one feature group to the previous cumulative set.

Step sequence:
  1. Baseline       — transaction features only (calendar + categorical)
  2. + Behavioral   — add velocity windows, amount deviation, account age
  3. + Device/IP    — add device/IP sharing features
  4. + Sequence     — add time-since-prev, velocity acceleration
  5. + Anomaly      — add Isolation Forest anomaly score as a feature
  6. + Graph        — add graph-derived features (if graph available)

Primary metric: val_auprc
Secondary:      val_f1, val_expected_loss

The test set is NEVER used in ablation.  We use validation AUPRC throughout.

If a feature group degrades AUPRC, we report it honestly — we do NOT
remove it from the ablation table or pretend it helped.

All runs are logged to MLflow under the 'zeno-fraud-detection' experiment
with run names like 'ablation-step-1', 'ablation-step-2', etc.

The final ablation table is saved as:
  ml/reports/ablation_<timestamp>.json
  ml/reports/ablation_<timestamp>.txt

Usage
─────
    python scripts/run_ablation.py --synthetic --n-samples 8000
    python scripts/run_ablation.py --max-rows 50000
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))

import mlflow
import numpy as np
import pandas as pd

from zeno_ml.evaluation.metrics import sweep_thresholds, evaluate
from zeno_ml.features.base import (
    TRANSACTION_FEATURES, BEHAVIORAL_FEATURES, DEVICE_IP_FEATURES,
    SEQUENCE_FEATURES, GRAPH_FEATURES, ALL_FEATURE_COLUMNS, FEATURE_VERSION,
)
from zeno_ml.models.splits import temporal_split, temporal_split_labels
from zeno_ml.models.xgboost_model import DEFAULT_XGB_PARAMS, XGBoostFraudModel
from zeno_ml.scripts_common import build_feature_matrix, load_dataset

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger("run_ablation")


# ── Ablation step definitions ─────────────────────────────────────────────

def _get_ablation_steps(include_anomaly: bool, include_graph: bool) -> list[dict]:
    """
    Returns ordered list of ablation steps.
    Each step specifies which feature columns to USE (cumulative).
    """
    steps = [
        {
            "name":   "baseline (transaction only)",
            "groups": ["transaction"],
            "cols":   TRANSACTION_FEATURES,
        },
        {
            "name":   "+ behavioral",
            "groups": ["transaction", "behavioral"],
            "cols":   TRANSACTION_FEATURES + BEHAVIORAL_FEATURES,
        },
        {
            "name":   "+ device/IP",
            "groups": ["transaction", "behavioral", "device_ip"],
            "cols":   TRANSACTION_FEATURES + BEHAVIORAL_FEATURES + DEVICE_IP_FEATURES,
        },
        {
            "name":   "+ sequence",
            "groups": ["transaction", "behavioral", "device_ip", "sequence"],
            "cols":   ALL_FEATURE_COLUMNS,   # all base features
        },
    ]
    if include_anomaly:
        # Anomaly score is injected as an extra column called 'anomaly_score_feature'
        anom_cols = ALL_FEATURE_COLUMNS + ["anomaly_score_feature"]
        steps.append({
            "name":   "+ anomaly score",
            "groups": ["transaction", "behavioral", "device_ip", "sequence", "anomaly"],
            "cols":   anom_cols,
        })
    if include_graph:
        graph_cols = (ALL_FEATURE_COLUMNS
                      + (["anomaly_score_feature"] if include_anomaly else [])
                      + GRAPH_FEATURES)
        steps.append({
            "name":   "+ graph features",
            "groups": ["transaction", "behavioral", "device_ip", "sequence",
                       "anomaly" if include_anomaly else None, "graph"],
            "cols":   [c for c in graph_cols if c],
        })
    return steps


def _select_columns(X: np.ndarray, all_cols: list[str], keep_cols: list[str]) -> np.ndarray:
    """Select column subset by name, returning a numpy view."""
    col_idx = [i for i, c in enumerate(all_cols) if c in keep_cols]
    return X[:, col_idx]


# ── Main ablation loop ────────────────────────────────────────────────────

def run(args: argparse.Namespace) -> None:
    mlflow_uri = f"file:///{(ROOT / 'mlruns').as_posix()}"
    mlflow.set_tracking_uri(mlflow_uri)
    mlflow.set_experiment("zeno-fraud-detection")

    report_dir = ROOT / "reports"
    report_dir.mkdir(exist_ok=True)

    # ── Data + split ──────────────────────────────────────────────────────
    df, labels, dataset_meta = load_dataset(args)
    split  = temporal_split(df, order_column="transaction_dt",
                             metadata={"dataset": dataset_meta["dataset_name"]})
    logger.info(split.summary())
    df_train, df_val, _ = split.apply(df)
    y_tr_s, y_va_s, _   = temporal_split_labels(labels, split)

    # Feature pipeline — build FULL feature matrix once
    X_train_full, y_train, scaler = build_feature_matrix(
        df_train, pd.Series(y_tr_s), fit_scaler=True
    )
    X_val_full, y_val, _ = build_feature_matrix(
        df_val, pd.Series(y_va_s), scaler=scaler
    )

    full_col_names = ALL_FEATURE_COLUMNS   # columns in X_train_full / X_val_full

    # Optional: inject Isolation Forest anomaly score as an extra feature column
    include_anomaly = False
    if args.with_anomaly:
        try:
            from zeno_ml.models.isolation_forest import AnomalyDetector
            from zeno_ml.inference.aggregator import normalize_anomaly_score

            detector = AnomalyDetector()
            detector.fit(X_train_full, y_train, feature_names=full_col_names)

            train_raw  = detector.score(X_train_full)
            val_raw    = detector.score(X_val_full)
            train_anom = np.array([normalize_anomaly_score(s) for s in train_raw])
            val_anom   = np.array([normalize_anomaly_score(s) for s in val_raw])

            X_train_full = np.hstack([X_train_full, train_anom.reshape(-1, 1)])
            X_val_full   = np.hstack([X_val_full,   val_anom.reshape(-1, 1)])
            full_col_names = full_col_names + ["anomaly_score_feature"]
            include_anomaly = True
            logger.info("Anomaly score feature injected.")
        except Exception as exc:   # noqa: BLE001
            logger.warning("Could not inject anomaly feature: %s", exc)

    steps = _get_ablation_steps(include_anomaly, include_graph=False)
    logger.info("Running %d ablation steps…", len(steps))

    ablation_rows: list[dict[str, Any]] = []

    for step_idx, step in enumerate(steps):
        step_name = step["name"]
        keep_cols = [c for c in step["cols"] if c in full_col_names]

        X_tr = _select_columns(X_train_full, full_col_names, keep_cols)
        X_va = _select_columns(X_val_full,   full_col_names, keep_cols)

        logger.info(
            "[%d/%d] %s — %d features",
            step_idx + 1, len(steps), step_name, X_tr.shape[1],
        )

        run_name = f"ablation-step-{step_idx + 1:02d}"
        with mlflow.start_run(run_name=run_name) as mrun:
            mlflow.log_params({
                "ablation_step":   step_idx + 1,
                "ablation_name":   step_name,
                "n_features":      X_tr.shape[1],
                "feature_groups":  str(step["groups"]),
                "feature_version": FEATURE_VERSION,
                "dataset":         dataset_meta["dataset_name"],
                "is_synthetic":    dataset_meta["is_synthetic"],
            })

            try:
                model = XGBoostFraudModel(model_version=f"ablation-step-{step_idx+1}")
                model.fit(X_tr, y_train, X_va, y_val,
                          fp_cost=args.fp_cost, fn_cost=args.fn_cost)
                vm = model.val_metrics

                mlflow.log_metrics({
                    "val_auprc":         round(vm.auprc, 4),
                    "val_f1":            round(vm.f1, 4),
                    "val_precision":     round(vm.precision, 4),
                    "val_recall":        round(vm.recall, 4),
                    "val_roc_auc":       round(vm.roc_auc, 4),
                    "val_expected_loss": round(vm.expected_loss, 2),
                })

                row = {
                    "step":              step_idx + 1,
                    "model":             step_name,
                    "feature_groups":    step["groups"],
                    "n_features":        X_tr.shape[1],
                    "val_auprc":         round(vm.auprc, 4),
                    "val_f1":            round(vm.f1, 4),
                    "val_precision":     round(vm.precision, 4),
                    "val_recall":        round(vm.recall, 4),
                    "val_roc_auc":       round(vm.roc_auc, 4),
                    "val_expected_loss": round(vm.expected_loss, 2),
                    "mlflow_run_id":     mrun.info.run_id,
                }
                ablation_rows.append(row)

            except Exception as exc:   # noqa: BLE001
                logger.error("Ablation step %d failed: %s", step_idx + 1, exc)
                mlflow.log_param("error", str(exc))

    # ── Print + save results ──────────────────────────────────────────────
    _print_table(ablation_rows)
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")

    report = {
        "generated_at":    datetime.now(timezone.utc).isoformat(),
        "dataset":         dataset_meta["dataset_name"],
        "feature_version": FEATURE_VERSION,
        "test_fingerprint": split.test_fingerprint[:32],
        "note": (
            "All metrics are on the VALIDATION set. "
            "The test set was not used. "
            "Results are MODEL ESTIMATES on synthetic data "
            "if is_synthetic=True."
        ),
        "is_synthetic":    dataset_meta["is_synthetic"],
        "fp_cost":         args.fp_cost,
        "fn_cost":         args.fn_cost,
        "ablation":        ablation_rows,
    }

    json_path = report_dir / f"ablation_{ts}.json"
    txt_path  = report_dir / f"ablation_{ts}.txt"
    json_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    txt_path.write_text(_build_text_report(report), encoding="utf-8")

    logger.info("Ablation report saved: %s", json_path)
    print(f"\n✓ Ablation complete. Report: {json_path}")


def _print_table(rows: list[dict]) -> None:
    if not rows:
        return
    header = f"{'Step':<4} {'Model':<45} {'AUPRC':>8} {'F1':>8} {'Expected Loss':>14} {'N Features':>12}"
    sep    = "-" * len(header)
    print(f"\n{header}\n{sep}")
    prev_auprc = None
    for r in rows:
        delta = ""
        if prev_auprc is not None:
            diff = r["val_auprc"] - prev_auprc
            delta = f"  ({'+' if diff >= 0 else ''}{diff:.4f})"
        print(
            f"{r['step']:<4} {r['model']:<45} "
            f"{r['val_auprc']:>8.4f}{delta:<14} "
            f"{r['val_f1']:>8.4f} "
            f"{r['val_expected_loss']:>14,.0f} "
            f"{r['n_features']:>12}"
        )
        prev_auprc = r["val_auprc"]
    print()


def _build_text_report(report: dict) -> str:
    lines = [
        "ZENO FRAUD DETECTION — ABLATION STUDY",
        "=" * 70,
        f"Generated : {report['generated_at']}",
        f"Dataset   : {report['dataset']}",
        f"Synthetic : {report['is_synthetic']}",
        f"FP Cost   : ${report['fp_cost']:.2f}   FN Cost: ${report['fn_cost']:.2f}",
        "",
        report["note"],
        "",
        f"{'Step':<4} {'Model':<45} {'AUPRC':>8} {'F1':>8} {'Exp Loss':>12}",
        "-" * 80,
    ]
    prev = None
    for r in report["ablation"]:
        delta = ""
        if prev is not None:
            diff = r["val_auprc"] - prev
            delta = f" ({'+' if diff >= 0 else ''}{diff:.4f})"
        lines.append(
            f"{r['step']:<4} {r['model']:<45} "
            f"{r['val_auprc']:>8.4f}{delta:<12} "
            f"{r['val_f1']:>8.4f} {r['val_expected_loss']:>12,.0f}"
        )
        prev = r["val_auprc"]
    return "\n".join(lines)


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Ablation study for XGBoost features")
    p.add_argument("--synthetic",     action="store_true")
    p.add_argument("--n-samples",     type=int,   default=8000)
    p.add_argument("--max-rows",      type=int,   default=None)
    p.add_argument("--fp-cost",       type=float, default=40.0)
    p.add_argument("--fn-cost",       type=float, default=200.0)
    p.add_argument("--with-anomaly",  action="store_true",
                   help="Include Isolation Forest anomaly score as a feature")
    return p.parse_args()


if __name__ == "__main__":
    run(_parse_args())

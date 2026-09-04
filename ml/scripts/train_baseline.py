"""
Logistic Regression baseline training script.

Usage
─────
With IEEE-CIS data (place CSVs in ml/data/raw/ieee-cis/ first):
    python scripts/train_baseline.py

With synthetic data (no download needed — for CI/testing):
    python scripts/train_baseline.py --synthetic --n-samples 5000

With a row limit for quick iteration:
    python scripts/train_baseline.py --max-rows 50000

Options
───────
  --synthetic           Use synthetic data instead of IEEE-CIS
  --n-samples INT       Number of synthetic samples (default 5000)
  --max-rows INT        Limit IEEE-CIS rows for faster runs
  --fp-cost FLOAT       False positive cost USD (default 40.0)
  --fn-cost FLOAT       False negative cost USD (default 200.0)
  --output-dir PATH     Where to save artefacts (default ml/data/artifacts/baseline)
  --mlflow-uri PATH     MLflow tracking URI (default ml/mlruns)
  --no-test             Skip final test-set evaluation (development mode)

MLflow experiment: zeno-fraud-detection
MLflow run name:   logistic-regression-baseline

What this script does
─────────────────────
1. Load dataset (IEEE-CIS or synthetic).
2. Apply temporal split (train 70% / val 15% / test 15%).
3. Run feature pipeline on each split (fit scaler on train only).
4. Train LogisticRegression with class_weight='balanced'.
5. Sweep thresholds on validation to minimise expected loss.
6. Log all hyperparameters and validation metrics to MLflow.
7. Evaluate ONCE on held-out test set with frozen threshold.
8. Log test metrics to MLflow.
9. Save artefacts and generate benchmark report.

LEAKAGE CONTROLS
─────────────────
• StandardScaler is fit on training data only, then applied to val/test.
• Threshold is selected on validation data only.
• Test evaluation happens once, after all tuning is complete.
• Feature pipeline respects temporal ordering within each split.
"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

# ── Path setup (run from ml/ directory or project root) ──────────────────
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "src"))

import mlflow
import numpy as np
import pandas as pd

from zeno_ml.evaluation.metrics import evaluate, sweep_thresholds
from zeno_ml.evaluation.report import BenchmarkReport, ModelEntry
from zeno_ml.features.base import ALL_FEATURE_COLUMNS, FEATURE_VERSION
from zeno_ml.models.baseline import BASELINE_HYPERPARAMS, BaselineModel
from zeno_ml.models.splits import (
    SplitResult,
    compute_fraud_rates,
    temporal_split,
    temporal_split_labels,
)
from zeno_ml.scripts_common import build_feature_matrix, load_dataset

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger("train_baseline")


# ─────────────────────────────────────────────────────────────────────────
# Data loading helpers
# ─────────────────────────────────────────────────────────────────────────

def load_ieee_cis_dataset(
    max_rows: int | None,
) -> tuple[pd.DataFrame, pd.Series]:
    """Load IEEE-CIS and return (mapped_df, labels)."""
    from zeno_ml.data.ieee_cis import load_ieee_cis_dataframe
    logger.info("Loading IEEE-CIS dataset …")
    df, labels = load_ieee_cis_dataframe(max_rows=max_rows)
    logger.info("Loaded %d rows. Fraud rate: %.4f", len(df), labels.mean())
    return df, labels


def load_synthetic_dataset(n_samples: int) -> tuple[pd.DataFrame, pd.Series]:
    """
    Generate a synthetic dataset using the same schema as IEEE-CIS output.
    Produces a DataFrame with 'transaction_dt' for temporal ordering and
    canonical feature columns.  Ground truth labels are included.

    This dataset is labelled as SYNTHETIC in the benchmark report.
    """
    from zeno_ml.data.schema import RawTransaction

    logger.info("Generating synthetic dataset: %d samples …", n_samples)
    rng = np.random.default_rng(42)

    # Time ordering: sequential integers 0..n_samples (like TransactionDT)
    transaction_dt = np.arange(n_samples, dtype=float)

    # Fraud labels: ~5% fraud rate
    is_fraud = rng.random(n_samples) < 0.05

    records = []
    for i in range(n_samples):
        fraud = bool(is_fraud[i])
        # Fraud transactions: higher amount, velocity burst, shared device
        amount = float(rng.exponential(200 if fraud else 80))
        amount = max(1.0, amount)
        device_id = f"DEV-{rng.integers(0, 20 if fraud else 200):04d}"
        ip_addr   = f"10.0.{rng.integers(0, 5 if fraud else 50)}.{rng.integers(1,255)}"
        acct_age  = int(rng.integers(0, 30 if fraud else 730))

        records.append({
            "transaction_id":  f"tx-{i:07d}",
            "merchant_id":     "synthetic-benchmark",
            "customer_id":     f"cust-{rng.integers(0, n_samples // 5):06d}",
            "transaction_dt":  float(i),
            "timestamp":       pd.Timestamp("2020-01-01", tz="UTC") + pd.Timedelta(seconds=i * 60),
            "amount":          amount,
            "currency":        "USD",
            "payment_method":  rng.choice(["CARD", "WALLET", "UNKNOWN"]),
            "device_id":       device_id,
            "ip_address":      ip_addr,
            "billing_country": rng.choice(["US", "GB", "DE", None]),
            "shipping_country":rng.choice(["US", "GB", "DE", None]),
            "merchant_category": rng.choice(["ELECTRONICS", "DIGITAL_GOODS", "UNKNOWN"]),
            "email_domain":    rng.choice(["gmail.com", "yahoo.com", None]),
            "is_refunded":     False,
            "refund_amount":   None,
            "data_source":     "SYNTHETIC",
            "account_age_days": acct_age,
        })

    df = pd.DataFrame(records)
    labels = pd.Series(is_fraud, dtype=bool)
    logger.info("Synthetic dataset ready. Fraud rate: %.4f", labels.mean())
    return df, labels


# ─────────────────────────────────────────────────────────────────────────
# Feature pipeline helpers
# ─────────────────────────────────────────────────────────────────────────

def build_feature_matrix(
    df_split: pd.DataFrame,
    labels_split: pd.Series,
    scaler=None,
    fit_scaler: bool = False,
) -> tuple[np.ndarray, np.ndarray, object]:
    """
    Convert a DataFrame split into (X, y, fitted_scaler).

    Converts DataFrame rows to RawTransaction objects, runs the feature
    pipeline, returns numpy arrays ready for sklearn.
    """
    from zeno_ml.data.schema import RawTransaction
    from zeno_ml.data.normalization import FORBIDDEN_FEATURE_COLUMNS

    transactions = _df_to_transactions(df_split)

    result = run_feature_pipeline(
        transactions=transactions,
        scaler=scaler,
        fit_scaler=fit_scaler,
        include_graph_features=False,  # graph features in Milestone 7
    )

    X = result.feature_matrix.values.astype(np.float32)
    y = labels_split.values.astype(bool)

    # Align y to feature_matrix row order (pipeline may reorder by timestamp)
    if len(y) != len(X):
        logger.warning(
            "Label count %d != feature matrix rows %d after pipeline. "
            "Some rows may have been dropped by validation.",
            len(y), len(X),
        )
        y = y[: len(X)]

    return X, y, result.scaler


def _df_to_transactions(df: pd.DataFrame):
    """Convert a canonical-mapped DataFrame to list[RawTransaction]."""
    from zeno_ml.data.schema import RawTransaction
    txs = []
    for _, row in df.iterrows():
        ts = row.get("timestamp")
        if ts is None or (isinstance(ts, float) and np.isnan(ts)):
            continue
        try:
            tx = RawTransaction(
                transaction_id=str(row["transaction_id"]),
                merchant_id=str(row["merchant_id"]),
                customer_id=str(row["customer_id"]),
                timestamp=pd.Timestamp(ts).to_pydatetime(),
                amount=float(row["amount"]),
                currency=str(row.get("currency", "USD")),
                payment_method=str(row.get("payment_method", "UNKNOWN")),
                device_id=row.get("device_id") if pd.notna(row.get("device_id")) else None,
                ip_address=row.get("ip_address") if pd.notna(row.get("ip_address")) else None,
                billing_country=row.get("billing_country") if pd.notna(row.get("billing_country")) else None,
                shipping_country=row.get("shipping_country") if pd.notna(row.get("shipping_country")) else None,
                merchant_category=str(row.get("merchant_category", "UNKNOWN")),
                email_domain=row.get("email_domain") if pd.notna(row.get("email_domain")) else None,
                is_refunded=False,
                data_source=str(row.get("data_source", "SYNTHETIC")),
            )
            txs.append(tx)
        except Exception as exc:  # noqa: BLE001
            logger.debug("Skipping row %s: %s", row.get("transaction_id"), exc)
    return txs


# ─────────────────────────────────────────────────────────────────────────
# Main training pipeline
# ─────────────────────────────────────────────────────────────────────────

def train(args: argparse.Namespace) -> None:
    mlflow_uri = args.mlflow_uri or f"file:///{(ROOT / 'mlruns').as_posix()}"
    mlflow.set_tracking_uri(mlflow_uri)
    mlflow.set_experiment("zeno-fraud-detection")

    output_dir = Path(args.output_dir or ROOT / "data" / "artifacts" / "baseline")
    output_dir.mkdir(parents=True, exist_ok=True)
    report_dir = ROOT / "reports"
    report_dir.mkdir(exist_ok=True)

    # ── 1. Load data ─────────────────────────────────────────────────────
    if args.synthetic:
        df, labels = load_synthetic_dataset(args.n_samples)
        dataset_name    = "synthetic-benchmark"
        dataset_version = "synthetic-v1"
        dataset_source  = "SYNTHETIC"
        is_synthetic    = True
        order_col       = "transaction_dt"
    else:
        df, labels = load_ieee_cis_dataset(args.max_rows)
        dataset_name    = "ieee-cis-fraud-detection"
        dataset_version = "ieee-cis-v1"
        dataset_source  = "IEEE-CIS"
        is_synthetic    = False
        order_col       = "transaction_dt"

    # ── 2. Temporal split ─────────────────────────────────────────────────
    logger.info("Applying temporal split …")
    split = temporal_split(
        df,
        order_column=order_col,
        metadata={"dataset": dataset_name, "version": dataset_version},
    )
    logger.info(split.summary())

    df_train, df_val, df_test   = split.apply(df)
    y_train, y_val, y_test      = temporal_split_labels(labels, split)
    fraud_rates                 = compute_fraud_rates(y_train, y_val, y_test)
    logger.info("Fraud rates: %s", fraud_rates)

    # ── 3. Feature pipeline ───────────────────────────────────────────────
    logger.info("Running feature pipeline on train split …")
    X_train, y_train, fitted_scaler = build_feature_matrix(
        df_train, pd.Series(y_train), fit_scaler=True
    )
    logger.info("Running feature pipeline on val split …")
    X_val, y_val, _ = build_feature_matrix(
        df_val, pd.Series(y_val), scaler=fitted_scaler
    )
    logger.info("Running feature pipeline on test split …")
    X_test, y_test, _ = build_feature_matrix(
        df_test, pd.Series(y_test), scaler=fitted_scaler
    )
    logger.info(
        "Feature matrix shapes: train=%s val=%s test=%s",
        X_train.shape, X_val.shape, X_test.shape,
    )

    # ── 4–8. Train + evaluate + log ───────────────────────────────────────
    with mlflow.start_run(run_name="logistic-regression-baseline") as run:
        logger.info("MLflow run: %s", run.info.run_id)

        # Log parameters
        mlflow.log_params({
            "algorithm":           "LogisticRegression",
            "feature_version":     FEATURE_VERSION,
            "dataset":             dataset_name,
            "dataset_version":     dataset_version,
            "is_synthetic":        is_synthetic,
            "n_train":             len(X_train),
            "n_val":               len(X_val),
            "n_test":              len(X_test),
            "train_fraud_rate":    round(float(y_train.mean()), 6),
            "val_fraud_rate":      round(float(y_val.mean()),   6),
            "class_weight":        "balanced",
            "solver":              BASELINE_HYPERPARAMS["solver"],
            "C":                   BASELINE_HYPERPARAMS["C"],
            "fp_cost":             args.fp_cost,
            "fn_cost":             args.fn_cost,
            "test_fingerprint":    split.test_fingerprint[:16],
            "temporal_order_col":  order_col,
        })

        # Train
        baseline = BaselineModel()
        baseline.fit(
            X_train, y_train,
            X_val,   y_val,
            fp_cost=args.fp_cost,
            fn_cost=args.fn_cost,
            fit_scaler=False,  # scaler already applied above
        )

        # Log validation metrics
        vm = baseline.val_metrics
        mlflow.log_metrics({
            "val_precision":     round(vm.precision, 4),
            "val_recall":        round(vm.recall,    4),
            "val_f1":            round(vm.f1,        4),
            "val_auprc":         round(vm.auprc,     4),
            "val_roc_auc":       round(vm.roc_auc,   4),
            "val_fpr":           round(vm.fpr,       4),
            "val_expected_loss": round(vm.expected_loss, 2),
            "val_threshold":     round(baseline.threshold, 4),
        })

        # Test evaluation
        test_metrics = None
        if not args.no_test:
            logger.info("Evaluating on held-out test set …")
            test_metrics = baseline.evaluate_test(
                X_test, y_test,
                fp_cost=args.fp_cost,
                fn_cost=args.fn_cost,
            )
            tm = test_metrics
            mlflow.log_metrics({
                "test_precision":     round(tm.precision, 4),
                "test_recall":        round(tm.recall,    4),
                "test_f1":            round(tm.f1,        4),
                "test_auprc":         round(tm.auprc,     4),
                "test_roc_auc":       round(tm.roc_auc,   4),
                "test_fpr":           round(tm.fpr,       4),
                "test_expected_loss": round(tm.expected_loss, 2),
            })

        # Save artefacts
        artefact_paths = baseline.save(output_dir)
        for name, path in artefact_paths.items():
            mlflow.log_artifact(str(path), artifact_path="model")

        # Benchmark report
        report = BenchmarkReport(
            dataset_name=dataset_name,
            dataset_version=dataset_version,
            dataset_source=dataset_source,
            is_synthetic=is_synthetic,
            n_train=split.n_train,
            n_val=split.n_val,
            n_test=split.n_test,
            train_fraud_rate=fraud_rates["train_fraud_rate"],
            val_fraud_rate=fraud_rates["val_fraud_rate"],
            test_fraud_rate=fraud_rates["test_fraud_rate"],
            order_column=order_col,
            test_fingerprint=split.test_fingerprint,
            fp_cost=args.fp_cost,
            fn_cost=args.fn_cost,
            models=[
                ModelEntry(
                    name="LogisticRegression-baseline",
                    algorithm="LogisticRegression",
                    feature_version=FEATURE_VERSION,
                    feature_groups=["transaction", "behavioral", "device_ip", "sequence"],
                    hyperparameters=BASELINE_HYPERPARAMS,
                    threshold=baseline.threshold,
                    val_metrics=vm,
                    test_metrics=test_metrics,
                    notes="Baseline — class_weight=balanced, StandardScaler.",
                )
            ],
        )

        json_path, text_path = report.save(report_dir)
        mlflow.log_artifact(str(json_path), artifact_path="reports")
        mlflow.log_artifact(str(text_path), artifact_path="reports")
        mlflow.log_param("report_json", json_path.name)

        logger.info("\n%s", report.to_text())
        logger.info("MLflow run %s complete.", run.info.run_id)
        logger.info("Artefacts saved to: %s", output_dir)
        logger.info("Reports saved to:   %s", report_dir)

    print("\n✓ Baseline training complete.")
    print(f"  MLflow UI: mlflow ui --backend-store-uri {mlflow_uri}")
    print(f"  Artefacts: {output_dir}")
    print(f"  Report:    {json_path}")


# ─────────────────────────────────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────────────────────────────────

def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Train Logistic Regression baseline")
    p.add_argument("--synthetic",    action="store_true",
                   help="Use synthetic data (no download needed)")
    p.add_argument("--n-samples",    type=int, default=5000,
                   help="Synthetic dataset size (default 5000)")
    p.add_argument("--max-rows",     type=int, default=None,
                   help="Limit IEEE-CIS rows for faster runs")
    p.add_argument("--fp-cost",      type=float, default=40.0,
                   help="False positive cost USD (default 40.0)")
    p.add_argument("--fn-cost",      type=float, default=200.0,
                   help="False negative cost USD (default 200.0)")
    p.add_argument("--output-dir",   type=str, default=None,
                   help="Artefact output directory")
    p.add_argument("--mlflow-uri",   type=str, default=None,
                   help="MLflow tracking URI")
    p.add_argument("--no-test",      action="store_true",
                   help="Skip test evaluation (development mode only)")
    return p.parse_args()


if __name__ == "__main__":
    train(_parse_args())

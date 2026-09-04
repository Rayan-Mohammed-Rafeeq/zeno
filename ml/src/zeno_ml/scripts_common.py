"""
Shared helpers used by all training scripts.

Keeps dataset loading and feature pipeline construction consistent
across train_baseline.py, train_xgboost.py, tune_xgboost.py, etc.
"""

from __future__ import annotations

import argparse
import logging
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


# ── Dataset loading ──────────────────────────────────────────────────────

def load_dataset(
    args: argparse.Namespace,
) -> tuple[pd.DataFrame, pd.Series, dict[str, Any]]:
    """
    Load either IEEE-CIS or synthetic dataset depending on args.

    Returns (df, labels, metadata_dict).
    metadata_dict fields map directly to BenchmarkReport constructor kwargs.
    """
    if args.synthetic:
        df, labels = _load_synthetic(getattr(args, "n_samples", 8000))
        meta = {
            "dataset_name":    "synthetic-benchmark",
            "dataset_version": "synthetic-v1",
            "dataset_source":  "SYNTHETIC",
            "is_synthetic":    True,
        }
    else:
        from zeno_ml.data.ieee_cis import load_ieee_cis_dataframe
        max_rows = getattr(args, "max_rows", None)
        logger.info("Loading IEEE-CIS dataset (max_rows=%s)…", max_rows)
        df, labels = load_ieee_cis_dataframe(max_rows=max_rows)
        meta = {
            "dataset_name":    "ieee-cis-fraud-detection",
            "dataset_version": "ieee-cis-v1",
            "dataset_source":  "IEEE-CIS",
            "is_synthetic":    False,
        }
    return df, labels, meta


def _load_synthetic(n_samples: int) -> tuple[pd.DataFrame, pd.Series]:
    """Generate a repeatable synthetic dataset for development/CI."""
    logger.info("Generating synthetic dataset: %d samples…", n_samples)
    rng = np.random.default_rng(42)
    is_fraud = rng.random(n_samples) < 0.05

    records = []
    for i in range(n_samples):
        fraud  = bool(is_fraud[i])
        amount = float(max(1.0, rng.exponential(200 if fraud else 80)))
        dev_id = f"DEV-{rng.integers(0, 20 if fraud else 200):04d}"
        ip_str = f"10.0.{rng.integers(0, 5 if fraud else 50)}.{rng.integers(1, 255)}"
        records.append({
            "transaction_id":   f"tx-{i:07d}",
            "merchant_id":      "synthetic-benchmark",
            "customer_id":      f"cust-{rng.integers(0, n_samples // 5):06d}",
            "transaction_dt":   float(i),
            "timestamp":        pd.Timestamp("2020-01-01", tz="UTC") + pd.Timedelta(seconds=i * 60),
            "amount":           amount,
            "currency":         "USD",
            "payment_method":   rng.choice(["CARD", "WALLET", "UNKNOWN"]),
            "device_id":        dev_id,
            "ip_address":       ip_str,
            "billing_country":  rng.choice(["US", "GB", "DE", None]),
            "shipping_country": rng.choice(["US", "GB", "DE", None]),
            "merchant_category":rng.choice(["ELECTRONICS", "DIGITAL_GOODS", "UNKNOWN"]),
            "email_domain":     rng.choice(["gmail.com", "yahoo.com", None]),
            "is_refunded":      False,
            "refund_amount":    None,
            "data_source":      "SYNTHETIC",
            "account_age_days": int(rng.integers(0, 30 if fraud else 730)),
        })

    df     = pd.DataFrame(records)
    labels = pd.Series(is_fraud, dtype=bool)
    logger.info("Synthetic dataset ready. Fraud rate: %.4f", labels.mean())
    return df, labels


# ── Feature pipeline ─────────────────────────────────────────────────────

def build_feature_matrix(
    df_split: pd.DataFrame,
    labels_split: pd.Series,
    scaler=None,
    fit_scaler: bool = False,
    include_graph: bool = False,
) -> tuple[np.ndarray, np.ndarray, Any]:
    """
    Convert a canonical-mapped DataFrame split into (X, y, fitted_scaler).

    Converts rows to RawTransaction objects, runs the full feature pipeline,
    returns float32 numpy arrays ready for sklearn/XGBoost.
    """
    from zeno_ml.data.schema import RawTransaction
    from zeno_ml.features.pipeline import run_feature_pipeline

    transactions = _df_to_transactions(df_split)
    if not transactions:
        n_feat = len(__import__("zeno_ml.features.base", fromlist=["ALL_FEATURE_COLUMNS"]).ALL_FEATURE_COLUMNS)
        return (
            np.zeros((0, n_feat), dtype=np.float32),
            np.zeros(0, dtype=bool),
            scaler,
        )

    result = run_feature_pipeline(
        transactions=transactions,
        scaler=scaler,
        fit_scaler=fit_scaler,
        include_graph_features=include_graph,
    )

    X = result.feature_matrix.values.astype(np.float32)
    y = labels_split.values.astype(bool)
    if len(y) != len(X):
        y = y[: len(X)]

    return X, y, result.scaler


def _df_to_transactions(df: pd.DataFrame):
    from zeno_ml.data.schema import RawTransaction
    txs = []
    for _, row in df.iterrows():
        ts = row.get("timestamp")
        if ts is None or (isinstance(ts, float) and np.isnan(ts)):
            continue
        try:
            txs.append(RawTransaction(
                transaction_id  = str(row["transaction_id"]),
                merchant_id     = str(row["merchant_id"]),
                customer_id     = str(row["customer_id"]),
                timestamp       = pd.Timestamp(ts).to_pydatetime(),
                amount          = float(row["amount"]),
                currency        = str(row.get("currency", "USD")),
                payment_method  = str(row.get("payment_method", "UNKNOWN")),
                device_id       = row.get("device_id") if pd.notna(row.get("device_id")) else None,
                ip_address      = row.get("ip_address") if pd.notna(row.get("ip_address")) else None,
                billing_country = row.get("billing_country") if pd.notna(row.get("billing_country")) else None,
                shipping_country= row.get("shipping_country") if pd.notna(row.get("shipping_country")) else None,
                merchant_category=str(row.get("merchant_category", "UNKNOWN")),
                email_domain    = row.get("email_domain") if pd.notna(row.get("email_domain")) else None,
                is_refunded     = False,
                data_source     = str(row.get("data_source", "SYNTHETIC")),
            ))
        except Exception as exc:  # noqa: BLE001
            logger.debug("Skipping row %s: %s", row.get("transaction_id"), exc)
    return txs

"""
Normalization layer — sits between data quality validation and feature engineering.

Responsibilities:
  - Convert RawTransaction list → pandas DataFrame in a deterministic schema.
  - Apply consistent column naming (snake_case, no spaces).
  - Ensure timestamps are UTC-aware and sortable.
  - Sort by (merchant_id, customer_id, timestamp) so all window computations
    that rely on ordering work correctly without re-sorting.
  - Add lightweight derived columns used by multiple feature groups:
      log_amount       — log1p(amount), stable for zero-protection
      hour_of_day      — 0–23
      day_of_week      — 0 (Mon) – 6 (Sun)
      country_mismatch — 1 if billing_country != shipping_country, else 0;
                         -1 if either is None (unknown)
  - Apply StandardScaler to continuous columns for models that require it
    (stored separately so the raw DataFrame is always preserved).

LEAKAGE CONTRACT:
  The scaler is fit ONLY on training data.  When normalizing validation,
  test, or inference data, call transform() with a pre-fit scaler — never
  fit_transform() outside the training pipeline.  This function raises
  clearly if misused.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

import numpy as np
import pandas as pd

from niro_ml.data.schema import RawTransaction

if TYPE_CHECKING:
    from sklearn.preprocessing import StandardScaler

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Column definitions
# ---------------------------------------------------------------------------

# Columns that are safe to use in ML feature matrices (no labels, no futures)
SAFE_RAW_COLUMNS: list[str] = [
    "transaction_id",
    "merchant_id",
    "customer_id",
    "timestamp",
    "amount",
    "currency",
    "payment_method",
    "device_id",
    "ip_address",
    "billing_country",
    "shipping_country",
    "merchant_category",
    "email_domain",
    "data_source",
]

# Columns that must NEVER enter a feature matrix (post-transaction outcomes)
FORBIDDEN_FEATURE_COLUMNS: list[str] = [
    "is_fraud",         # ground truth label — evaluation only
    "is_refunded",      # post-transaction outcome
    "refund_amount",    # post-transaction outcome
]

# Continuous columns for optional StandardScaler transform
CONTINUOUS_COLUMNS: list[str] = ["amount", "log_amount"]


# ---------------------------------------------------------------------------
# Normalization result
# ---------------------------------------------------------------------------

@dataclass
class NormalizationResult:
    """
    Output of the normalization step.

    df : full normalized DataFrame, sorted by (merchant_id, customer_id, timestamp)
    label_series : pd.Series[bool | None] — ground truth labels aligned to df.index
                   None values mean label is absent (inference / unlabeled data).
    scaler : fitted StandardScaler if fit_scaler=True was requested, else None.
    """
    df: pd.DataFrame
    label_series: "pd.Series"
    scaler: "StandardScaler | None" = None


# ---------------------------------------------------------------------------
# Main normalization function
# ---------------------------------------------------------------------------

def normalize_transactions(
    transactions: list[RawTransaction],
    fit_scaler: bool = False,
    scaler: "StandardScaler | None" = None,
) -> NormalizationResult:
    """
    Convert a list of validated RawTransaction objects into a normalized
    pandas DataFrame ready for feature engineering.

    Parameters
    ----------
    transactions :
        Output of DataQualityValidator.validate().accepted
    fit_scaler :
        If True, fit a NEW StandardScaler on continuous columns and attach it
        to the result.  Use ONLY on training data.
    scaler :
        Pre-fit StandardScaler from training. Pass when normalizing
        validation/test/inference data.  Mutually exclusive with fit_scaler.

    Returns
    -------
    NormalizationResult

    Raises
    ------
    ValueError
        If fit_scaler=True and scaler is also provided (ambiguous intent).
    """
    if fit_scaler and scaler is not None:
        raise ValueError(
            "fit_scaler=True and a pre-fit scaler were both provided. "
            "Pass fit_scaler=True only on training data and store the result; "
            "pass the stored scaler for validation/test/inference."
        )

    if not transactions:
        logger.warning("normalize_transactions called with empty list.")
        empty_df = pd.DataFrame(columns=SAFE_RAW_COLUMNS + ["log_amount", "hour_of_day", "day_of_week", "country_mismatch"])
        empty_labels = pd.Series(dtype=object)
        return NormalizationResult(df=empty_df, label_series=empty_labels)

    # ── Build raw DataFrame ───────────────────────────────────────────
    records = []
    labels  = []

    for tx in transactions:
        row = {
            "transaction_id":    tx.transaction_id,
            "merchant_id":       tx.merchant_id,
            "customer_id":       tx.customer_id,
            "timestamp":         tx.timestamp,
            "amount":            tx.amount,
            "currency":          tx.currency,
            "payment_method":    tx.payment_method,
            "device_id":         tx.device_id,
            "ip_address":        tx.ip_address,
            "billing_country":   tx.billing_country,
            "shipping_country":  tx.shipping_country,
            "merchant_category": tx.merchant_category,
            "email_domain":      tx.email_domain,
            "data_source":       tx.data_source,
        }
        records.append(row)
        labels.append(tx.is_fraud)

    df = pd.DataFrame(records)

    # ── Timestamp normalization ───────────────────────────────────────
    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)

    # ── Sort: critical for all window-based feature computations ─────
    # Sorting here once means every downstream groupby().apply() is
    # already in chronological order within each (merchant, customer).
    df = df.sort_values(
        ["merchant_id", "customer_id", "timestamp"],
        ascending=[True, True, True],
    ).reset_index(drop=True)

    # Re-align labels to the sorted order
    label_series = pd.Series(
        [labels[i] for i in df.index],
        index=df.index,
        name="is_fraud",
        dtype=object,
    )
    # After reset_index the old index is gone — rebuild label alignment
    # by re-extracting from the sorted df
    # (reset_index drops the original positional index; we need to re-map)
    # Simpler: build a dict keyed by transaction_id then map
    tx_id_to_label = {tx.transaction_id: tx.is_fraud for tx in transactions}
    label_series = df["transaction_id"].map(tx_id_to_label)
    label_series.name = "is_fraud"

    # ── Derived columns ───────────────────────────────────────────────
    df["log_amount"]      = np.log1p(df["amount"])
    df["hour_of_day"]     = df["timestamp"].dt.hour.astype(np.int8)
    df["day_of_week"]     = df["timestamp"].dt.dayofweek.astype(np.int8)  # 0=Mon
    df["country_mismatch"] = _country_mismatch(
        df["billing_country"], df["shipping_country"]
    )

    # ── Optional scaler ───────────────────────────────────────────────
    fitted_scaler: "StandardScaler | None" = None
    if fit_scaler or scaler is not None:
        from sklearn.preprocessing import StandardScaler as _SS

        cont = df[CONTINUOUS_COLUMNS].fillna(0.0)
        if fit_scaler:
            fitted_scaler = _SS()
            df[CONTINUOUS_COLUMNS] = fitted_scaler.fit_transform(cont)
            logger.info("StandardScaler fitted on %d training rows.", len(df))
        else:
            df[CONTINUOUS_COLUMNS] = scaler.transform(cont)  # type: ignore[union-attr]
            fitted_scaler = scaler

    # ── Safety: ensure forbidden columns are not present ─────────────
    for col in FORBIDDEN_FEATURE_COLUMNS:
        if col in df.columns:
            df = df.drop(columns=[col])
            logger.warning(
                "Forbidden column '%s' was present in normalized DataFrame and "
                "has been removed. Check the ingestion pipeline.",
                col,
            )

    return NormalizationResult(
        df=df,
        label_series=label_series,
        scaler=fitted_scaler,
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _country_mismatch(
    billing: "pd.Series",
    shipping: "pd.Series",
) -> "pd.Series":
    """
    Compute country mismatch indicator.

    Returns:
        1   — billing != shipping (and both known)
        0   — billing == shipping (and both known)
        -1  — at least one is None/NaN (unknown)
    """
    result = pd.Series(index=billing.index, dtype=np.int8)
    both_known = billing.notna() & shipping.notna()
    result[~both_known]               = -1
    result[both_known & (billing != shipping)] =  1
    result[both_known & (billing == shipping)] =  0
    return result

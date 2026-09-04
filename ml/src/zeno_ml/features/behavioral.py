"""
Customer behavioral features — the most leakage-sensitive module.

LEAKAGE CONTRACT
────────────────
Every aggregation in this module anchors to tx.timestamp and uses
STRICTLY LESS THAN (<) comparisons, never <=.

Correct:  prior_txs = customer_history[customer_history.timestamp < tx.timestamp]
Wrong:    prior_txs = customer_history[customer_history.timestamp <= tx.timestamp]
          (would include the current transaction itself)

Wrong:    customer_total_transactions  (uses ALL history, including future)
Correct:  tx_count_24h                 (uses only the 24h window before tx)

The unit tests in tests/test_leakage.py assert this contract programmatically.

Features produced:
  tx_count_5min                    — velocity in the 5 minutes before this tx
  tx_count_1h                      — velocity in the 1 hour before this tx
  tx_count_24h                     — velocity in the 24 hours before this tx
  amount_sum_1h                    — total amount in the 1 hour before this tx
  amount_sum_24h                   — total amount in the 24 hours before this tx
  customer_avg_amount_historical   — mean amount of ALL prior txs (< timestamp)
  customer_median_amount_historical— median amount of ALL prior txs (< timestamp)
  amount_deviation_from_mean       — (amount - hist_mean) / (hist_std + ε)
  amount_zscore                    — same as deviation, capped at ±10 for stability
  account_age_days                 — from CustomerContext; -1 if unknown
  account_age_missing              — indicator: 1 if account_age_days was unknown
  historical_refund_rate           — refund_count / tx_count for prior txs
  historical_refund_rate_missing   — 1 if no prior transactions exist
  historical_fraud_rate            — from CustomerContext; only prior labels
  historical_fraud_rate_missing    — 1 if no prior labeled history

Implementation note:
  The DataFrame must be sorted by (merchant_id, customer_id, timestamp)
  before this function is called — normalization.normalize_transactions()
  guarantees this.  Each row's features are computed using a rolling
  approach within customer groups so no future rows are ever visible.
"""

from __future__ import annotations

import logging
from datetime import timedelta

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# Window sizes
_5MIN  = timedelta(minutes=5)
_1H    = timedelta(hours=1)
_24H   = timedelta(hours=24)
_EPS   = 1e-8    # numerical stability


def add_behavioral_features(
    df: pd.DataFrame,
    customer_contexts: "dict[str, CustomerContext] | None" = None,  # noqa: F821
) -> pd.DataFrame:
    """
    Compute behavioral features for every row in df.

    The DataFrame MUST be sorted by (merchant_id, customer_id, timestamp)
    — this is guaranteed by normalization.normalize_transactions().

    Parameters
    ----------
    df :
        Normalized, sorted DataFrame from the normalization layer.
    customer_contexts :
        Optional mapping of customer_id -> CustomerContext objects.
        When provided, account_age_days, historical_refund_rate, and
        historical_fraud_rate are pulled from the context rather than
        computed from the DataFrame (used in real-time inference where
        full history may not be in-memory).

    Returns
    -------
    df with behavioral feature columns added (in-place + returned).
    """
    _init_behavioral_columns(df)

    # Group by (merchant_id, customer_id) — compute within each group
    # to respect merchant isolation and avoid cross-customer contamination.
    groups = df.groupby(["merchant_id", "customer_id"], sort=False)

    results: list[pd.DataFrame] = []
    for (merchant_id, customer_id), group in groups:
        group = group.copy().sort_values("timestamp")
        _compute_group_behavioral(group, customer_contexts, customer_id)
        results.append(group)

    if not results:
        return df

    updated = pd.concat(results).sort_index()

    # Copy computed columns back into the original df by index
    behavioral_cols = [
        "tx_count_5min", "tx_count_1h", "tx_count_24h",
        "amount_sum_1h", "amount_sum_24h",
        "customer_avg_amount_historical", "customer_median_amount_historical",
        "amount_deviation_from_mean", "amount_zscore",
        "account_age_days", "account_age_missing",
        "historical_refund_rate", "historical_refund_rate_missing",
        "historical_fraud_rate", "historical_fraud_rate_missing",
    ]
    for col in behavioral_cols:
        if col in updated.columns:
            df[col] = updated[col]

    return df


def _init_behavioral_columns(df: pd.DataFrame) -> None:
    """Pre-allocate all behavioral feature columns with sentinel values."""
    float_cols = [
        "tx_count_5min", "tx_count_1h", "tx_count_24h",
        "amount_sum_1h", "amount_sum_24h",
        "customer_avg_amount_historical", "customer_median_amount_historical",
        "amount_deviation_from_mean", "amount_zscore",
        "account_age_days",
        "historical_refund_rate", "historical_fraud_rate",
    ]
    int8_cols = [
        "account_age_missing",
        "historical_refund_rate_missing",
        "historical_fraud_rate_missing",
    ]
    for col in float_cols:
        df[col] = 0.0
    for col in int8_cols:
        df[col] = np.int8(0)


def _compute_group_behavioral(
    group: pd.DataFrame,
    customer_contexts: "dict | None",
    customer_id: str,
) -> None:
    """
    Compute behavioral features for a single (merchant, customer) group.
    Modifies group in-place.

    LEAKAGE GUARANTEE: for each row at position i, only rows at positions
    0..i-1 (strictly earlier timestamps) are ever used in computations.
    """
    timestamps = group["timestamp"].values   # numpy datetime64 array
    amounts    = group["amount"].values       # float64 array
    n          = len(group)
    idx        = group.index

    # Pull context once
    ctx = None
    if customer_contexts and customer_id in customer_contexts:
        ctx = customer_contexts[customer_id]

    for i in range(n):
        ts_i = pd.Timestamp(timestamps[i])
        amt_i = float(amounts[i])

        # ── Prior transactions (strictly before ts_i) ─────────────────
        # This is the leakage boundary: j < i (not j <= i)
        prior_mask = timestamps[:i]  # all elements before index i
        prior_ts   = pd.DatetimeIndex([pd.Timestamp(t) for t in prior_mask])
        prior_amt  = amounts[:i]

        # Velocity windows
        group.at[idx[i], "tx_count_5min"] = _count_in_window(prior_ts, ts_i, _5MIN)
        group.at[idx[i], "tx_count_1h"]   = _count_in_window(prior_ts, ts_i, _1H)
        group.at[idx[i], "tx_count_24h"]  = _count_in_window(prior_ts, ts_i, _24H)

        # Amount sums
        group.at[idx[i], "amount_sum_1h"]  = _sum_in_window(prior_ts, prior_amt, ts_i, _1H)
        group.at[idx[i], "amount_sum_24h"] = _sum_in_window(prior_ts, prior_amt, ts_i, _24H)

        # Historical amount statistics (all prior, not just windowed)
        if len(prior_amt) > 0:
            hist_mean   = float(np.mean(prior_amt))
            hist_median = float(np.median(prior_amt))
            hist_std    = float(np.std(prior_amt))
            group.at[idx[i], "customer_avg_amount_historical"]    = hist_mean
            group.at[idx[i], "customer_median_amount_historical"]  = hist_median
            group.at[idx[i], "amount_deviation_from_mean"] = (amt_i - hist_mean) / (hist_std + _EPS)
            group.at[idx[i], "amount_zscore"] = float(
                np.clip((amt_i - hist_mean) / (hist_std + _EPS), -10, 10)
            )
        # else: leave at 0.0 (first transaction — no history)

        # ── Account age ───────────────────────────────────────────────
        if ctx is not None and ctx.account_age_days is not None:
            group.at[idx[i], "account_age_days"]    = float(ctx.account_age_days)
            group.at[idx[i], "account_age_missing"] = np.int8(0)
        else:
            group.at[idx[i], "account_age_days"]    = -1.0
            group.at[idx[i], "account_age_missing"] = np.int8(1)

        # ── Historical refund rate ────────────────────────────────────
        if ctx is not None:
            prior_count = ctx.historical_transaction_count
            refund_count = ctx.historical_refund_count
            if prior_count > 0:
                group.at[idx[i], "historical_refund_rate"]         = refund_count / prior_count
                group.at[idx[i], "historical_refund_rate_missing"] = np.int8(0)
            else:
                group.at[idx[i], "historical_refund_rate"]         = 0.0
                group.at[idx[i], "historical_refund_rate_missing"] = np.int8(1)

            # ── Historical fraud rate (prior labels only) ─────────────
            if ctx.historical_fraud_rate is not None:
                group.at[idx[i], "historical_fraud_rate"]         = ctx.historical_fraud_rate
                group.at[idx[i], "historical_fraud_rate_missing"] = np.int8(0)
            else:
                group.at[idx[i], "historical_fraud_rate"]         = 0.0
                group.at[idx[i], "historical_fraud_rate_missing"] = np.int8(1)
        else:
            # No context: compute refund rate from the in-memory group (training mode)
            # Only prior transactions — same leakage boundary as above
            # For training we don't have a separate refund column here;
            # leave as 0 / missing=1.  The feature pipeline composer will
            # optionally supply contexts when they're available.
            group.at[idx[i], "historical_refund_rate_missing"] = np.int8(1)
            group.at[idx[i], "historical_fraud_rate_missing"]  = np.int8(1)


# ---------------------------------------------------------------------------
# Window helpers — all use strict < (never <=) on the anchor timestamp
# ---------------------------------------------------------------------------

def _count_in_window(
    prior_timestamps: "pd.DatetimeIndex",
    anchor: pd.Timestamp,
    window: timedelta,
) -> float:
    """
    Count prior transactions in the closed-open window [anchor - window, anchor).

    Left bound is INCLUSIVE (>=) so a transaction at exactly anchor - window
    is counted.  Right bound is EXCLUSIVE (<) so the current transaction at
    anchor is never counted (the current tx is already excluded from
    prior_timestamps since we only pass timestamps[:i] to this function).
    """
    if len(prior_timestamps) == 0:
        return 0.0
    cutoff = anchor - window
    mask = (prior_timestamps >= cutoff) & (prior_timestamps < anchor)
    return float(mask.sum())


def _sum_in_window(
    prior_timestamps: "pd.DatetimeIndex",
    prior_amounts: "np.ndarray",
    anchor: pd.Timestamp,
    window: timedelta,
) -> float:
    """
    Sum amounts in the closed-open window [anchor - window, anchor).
    """
    if len(prior_timestamps) == 0:
        return 0.0
    cutoff = anchor - window
    mask = (prior_timestamps >= cutoff) & (prior_timestamps < anchor)
    return float(prior_amounts[mask].sum())

"""
Behavioral sequence features — captures temporal patterns within a customer's
transaction stream.

LEAKAGE CONTRACT
────────────────
The "previous transaction" for each row means the most recent transaction
STRICTLY BEFORE this one (timestamp < current) for the same customer.
If no prior transaction exists, the feature is 0 with the missing indicator = 1.

Features produced:
  seconds_since_prev_tx         — seconds elapsed since the customer's previous tx
  seconds_since_prev_tx_missing — 1 if this is the customer's first transaction
  amount_change_from_prev       — amount - prev_amount (0 if no prior tx)
  amount_change_pct             — (amount - prev) / (prev + ε) (0 if no prior tx)
  velocity_acceleration         — tx_count_1h / (tx_count_24h + ε)
                                   measures whether velocity is concentrated recently
  repeated_amount               — 1 if amount matches any prior tx amount within 24h
                                   tolerance ±1% (structuring signal)

Prerequisite: behavioral features (tx_count_1h, tx_count_24h) must already
be computed before calling add_sequence_features().
"""

from __future__ import annotations

import logging
from datetime import timedelta

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

_EPS = 1e-8
_24H = timedelta(hours=24)
_AMOUNT_TOLERANCE = 0.01   # 1% tolerance for repeated_amount detection


def add_sequence_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Compute sequence features for all rows in df.

    Prerequisites: df must have been through add_behavioral_features()
    so tx_count_1h and tx_count_24h are present.

    Returns df with new columns appended (in-place).
    """
    _init_sequence_columns(df)

    for (merchant_id, customer_id), group in df.groupby(
        ["merchant_id", "customer_id"], sort=False
    ):
        group_sorted = group.sort_values("timestamp")
        _compute_group_sequence(df, group_sorted)

    return df


def _init_sequence_columns(df: pd.DataFrame) -> None:
    df["seconds_since_prev_tx"]         = 0.0
    df["seconds_since_prev_tx_missing"] = np.int8(1)   # assume missing; set to 0 when found
    df["amount_change_from_prev"]       = 0.0
    df["amount_change_pct"]             = 0.0
    df["velocity_acceleration"]         = 0.0
    df["repeated_amount"]               = np.int8(0)


def _compute_group_sequence(
    df: pd.DataFrame,
    group: pd.DataFrame,
) -> None:
    """
    Compute sequence features for one (merchant, customer) group.
    Writes directly into df by row index.
    """
    ts_arr  = group["timestamp"].values
    amt_arr = group["amount"].values
    idx     = group.index
    n       = len(group)

    for i in range(n):
        row_idx = idx[i]
        ts_i    = pd.Timestamp(ts_arr[i])
        amt_i   = float(amt_arr[i])

        # ── Prior transactions (strict <) ────────────────────────────
        # i == 0 means no prior transactions
        if i == 0:
            # All sequence features remain at their init values (0, missing=1)
            pass
        else:
            # Most recent prior transaction
            prev_ts  = pd.Timestamp(ts_arr[i - 1])
            prev_amt = float(amt_arr[i - 1])

            # Seconds since previous
            delta_seconds = (ts_i - prev_ts).total_seconds()
            df.at[row_idx, "seconds_since_prev_tx"]         = max(0.0, delta_seconds)
            df.at[row_idx, "seconds_since_prev_tx_missing"] = np.int8(0)

            # Amount change
            df.at[row_idx, "amount_change_from_prev"] = amt_i - prev_amt
            df.at[row_idx, "amount_change_pct"]       = (amt_i - prev_amt) / (prev_amt + _EPS)

        # ── Velocity acceleration ─────────────────────────────────────
        # Requires tx_count_1h and tx_count_24h already computed
        count_1h  = float(df.at[row_idx, "tx_count_1h"])  if "tx_count_1h"  in df.columns else 0.0
        count_24h = float(df.at[row_idx, "tx_count_24h"]) if "tx_count_24h" in df.columns else 0.0
        df.at[row_idx, "velocity_acceleration"] = count_1h / (count_24h + _EPS)

        # ── Repeated amount (structuring signal) ────────────────────
        # Check if any prior transaction within 24h has a similar amount (±1%)
        if i > 0:
            cutoff = np.datetime64(ts_i - _24H)
            anchor = np.datetime64(ts_i)
            prior_ts_arr = np.array(ts_arr[:i], dtype="datetime64[ns]")
            in_window = (prior_ts_arr >= cutoff) & (prior_ts_arr < anchor)
            prior_amts_window = amt_arr[:i][in_window]

            if len(prior_amts_window) > 0:
                # ±1% tolerance
                low  = amt_i * (1.0 - _AMOUNT_TOLERANCE)
                high = amt_i * (1.0 + _AMOUNT_TOLERANCE)
                if np.any((prior_amts_window >= low) & (prior_amts_window <= high)):
                    df.at[row_idx, "repeated_amount"] = np.int8(1)

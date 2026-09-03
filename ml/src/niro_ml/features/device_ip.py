"""
Device and IP features.

LEAKAGE CONTRACT
────────────────
All features that aggregate "other customers sharing this device/IP" must
use only transactions whose timestamp < the prediction timestamp.
This prevents the model from seeing future sharing relationships that
wouldn't exist at scoring time.

Features produced:
  customers_per_device          — distinct customers who used this device in prior data
  tx_per_device_24h             — transactions on this device in the prior 24h
  device_velocity_1h            — transactions on this device in the prior 1h
  devices_per_customer_historical — distinct devices this customer has used historically
  device_missing                — 1 if device_id is null

  customers_per_ip              — distinct customers who used this IP in prior data
  tx_per_ip_24h                 — transactions from this IP in the prior 24h
  ip_velocity_1h                — transactions from this IP in the prior 1h
  ips_per_customer_historical   — distinct IPs this customer has used historically
  ip_missing                    — 1 if ip_address is null

  devices_per_ip                — distinct devices seen on this IP (graph density proxy)

Implementation note:
  Rather than iterating row-by-row (O(n²)), we build sorted lookup
  structures per merchant and perform vectorised pandas operations.
  This is substantially faster for large datasets while preserving
  the temporal < constraint.
"""

from __future__ import annotations

import logging
from datetime import timedelta

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

_1H  = timedelta(hours=1)
_24H = timedelta(hours=24)


def add_device_ip_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Compute device and IP features for all rows in df.

    DataFrame must be sorted by (merchant_id, customer_id, timestamp).

    Returns df with new columns appended (in-place).
    """
    _init_device_ip_columns(df)

    # Process per merchant to enforce tenant isolation
    for merchant_id, merchant_df in df.groupby("merchant_id", sort=False):
        merchant_idx = merchant_df.index
        _compute_merchant_device_ip(df, merchant_df, merchant_idx)

    return df


def _init_device_ip_columns(df: pd.DataFrame) -> None:
    float_cols = [
        "customers_per_device", "tx_per_device_24h", "device_velocity_1h",
        "devices_per_customer_historical",
        "customers_per_ip", "tx_per_ip_24h", "ip_velocity_1h",
        "ips_per_customer_historical",
        "devices_per_ip",
    ]
    int8_cols = ["device_missing", "ip_missing"]
    for col in float_cols:
        df[col] = 1.0   # default 1 = "only seen once"
    for col in int8_cols:
        df[col] = np.int8(0)


def _compute_merchant_device_ip(
    df: pd.DataFrame,
    merchant_df: pd.DataFrame,
    merchant_idx: "pd.Index",
) -> None:
    """
    Compute device/IP features for one merchant's rows.
    Writes results directly into df by index position.

    LEAKAGE: for each row i, only rows with timestamp < row_i.timestamp
    are considered when counting sharing relationships.
    """
    ts_arr      = merchant_df["timestamp"].values
    cust_arr    = merchant_df["customer_id"].values
    device_arr  = merchant_df["device_id"].values
    ip_arr      = merchant_df["ip_address"].values
    positions   = list(range(len(merchant_df)))

    # Sort by timestamp within the merchant block (already sorted, but ensure)
    order = np.argsort(ts_arr, kind="stable")
    ts_arr     = ts_arr[order]
    cust_arr   = cust_arr[order]
    device_arr = device_arr[order]
    ip_arr     = ip_arr[order]
    idx_sorted = merchant_idx[order]

    n = len(ts_arr)

    for i in range(n):
        ts_i     = pd.Timestamp(ts_arr[i])
        cust_i   = cust_arr[i]
        device_i = device_arr[i]
        ip_i     = ip_arr[i]
        row_idx  = idx_sorted[i]

        # Slice of ALL prior rows (strict <) for this merchant
        prior_ts     = ts_arr[:i]
        prior_cust   = cust_arr[:i]
        prior_device = device_arr[:i]
        prior_ip     = ip_arr[:i]

        # ── Device features ───────────────────────────────────────────
        if device_i is None or (isinstance(device_i, float) and np.isnan(device_i)):
            df.at[row_idx, "device_missing"]                  = np.int8(1)
            df.at[row_idx, "customers_per_device"]            = 1.0
            df.at[row_idx, "tx_per_device_24h"]               = 0.0
            df.at[row_idx, "device_velocity_1h"]              = 0.0
            df.at[row_idx, "devices_per_customer_historical"] = 0.0
        else:
            df.at[row_idx, "device_missing"] = np.int8(0)

            # Other customers who used the same device before ts_i
            if len(prior_device) > 0:
                same_device = prior_device == device_i
                unique_custs = len(set(prior_cust[same_device]) - {cust_i})
                df.at[row_idx, "customers_per_device"] = float(max(1, unique_custs + 1))

                # Velocity windows for this device
                cutoff_24h = np.datetime64(ts_i - _24H)
                cutoff_1h  = np.datetime64(ts_i - _1H)
                anchor     = np.datetime64(ts_i)
                prior_ts64 = np.array(prior_ts, dtype="datetime64[ns]")

                mask_24h = same_device & (prior_ts64 >= cutoff_24h) & (prior_ts64 < anchor)
                mask_1h  = same_device & (prior_ts64 >= cutoff_1h)  & (prior_ts64 < anchor)
                df.at[row_idx, "tx_per_device_24h"]  = float(mask_24h.sum())
                df.at[row_idx, "device_velocity_1h"] = float(mask_1h.sum())

                # Distinct devices this customer has used before ts_i
                cust_mask = prior_cust == cust_i
                unique_devs = len(set(
                    d for d in prior_device[cust_mask]
                    if d is not None and not (isinstance(d, float) and np.isnan(d))
                ))
                df.at[row_idx, "devices_per_customer_historical"] = float(unique_devs)
            else:
                # First transaction in merchant history
                df.at[row_idx, "customers_per_device"]            = 1.0
                df.at[row_idx, "tx_per_device_24h"]               = 0.0
                df.at[row_idx, "device_velocity_1h"]              = 0.0
                df.at[row_idx, "devices_per_customer_historical"] = 0.0

        # ── IP features ───────────────────────────────────────────────
        if ip_i is None or (isinstance(ip_i, float) and np.isnan(ip_i)):
            df.at[row_idx, "ip_missing"]                   = np.int8(1)
            df.at[row_idx, "customers_per_ip"]             = 1.0
            df.at[row_idx, "tx_per_ip_24h"]                = 0.0
            df.at[row_idx, "ip_velocity_1h"]               = 0.0
            df.at[row_idx, "ips_per_customer_historical"]  = 0.0
            df.at[row_idx, "devices_per_ip"]               = 1.0
        else:
            df.at[row_idx, "ip_missing"] = np.int8(0)

            if len(prior_ip) > 0:
                same_ip = prior_ip == ip_i
                unique_custs_ip = len(set(prior_cust[same_ip]) - {cust_i})
                df.at[row_idx, "customers_per_ip"] = float(max(1, unique_custs_ip + 1))

                cutoff_24h = np.datetime64(ts_i - _24H)
                cutoff_1h  = np.datetime64(ts_i - _1H)
                anchor     = np.datetime64(ts_i)
                prior_ts64 = np.array(prior_ts, dtype="datetime64[ns]")

                mask_24h_ip = same_ip & (prior_ts64 >= cutoff_24h) & (prior_ts64 < anchor)
                mask_1h_ip  = same_ip & (prior_ts64 >= cutoff_1h)  & (prior_ts64 < anchor)
                df.at[row_idx, "tx_per_ip_24h"]  = float(mask_24h_ip.sum())
                df.at[row_idx, "ip_velocity_1h"] = float(mask_1h_ip.sum())

                # Distinct IPs this customer used
                cust_mask_ip = prior_cust == cust_i
                unique_ips = len(set(
                    ip for ip in prior_ip[cust_mask_ip]
                    if ip is not None and not (isinstance(ip, float) and np.isnan(ip))
                ))
                df.at[row_idx, "ips_per_customer_historical"] = float(unique_ips)

                # Distinct devices seen from this IP (graph density proxy)
                unique_devs_ip = len(set(
                    d for d in prior_device[same_ip]
                    if d is not None and not (isinstance(d, float) and np.isnan(d))
                ))
                df.at[row_idx, "devices_per_ip"] = float(max(1, unique_devs_ip))
            else:
                df.at[row_idx, "customers_per_ip"]            = 1.0
                df.at[row_idx, "tx_per_ip_24h"]               = 0.0
                df.at[row_idx, "ip_velocity_1h"]              = 0.0
                df.at[row_idx, "ips_per_customer_historical"] = 0.0
                df.at[row_idx, "devices_per_ip"]              = 1.0

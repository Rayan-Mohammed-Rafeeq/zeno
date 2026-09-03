"""
Transaction-level features.

These are derived entirely from the fields of a single transaction row —
no historical look-back required, so temporal leakage is not a concern here.

Features produced (see base.TRANSACTION_FEATURES for the full list):
  amount              — raw amount (already in the normalized DataFrame)
  log_amount          — log1p(amount) (already in normalized DataFrame)
  hour_of_day         — 0–23 (already derived in normalization)
  day_of_week         — 0 (Mon) – 6 (Sun) (already derived in normalization)
  is_weekend          — 1 if day_of_week in {5, 6}
  is_night            — 1 if hour_of_day in {0..5}
  payment_method_enc  — ordinal encoding of PaymentMethod
  merchant_category_enc — ordinal encoding of MerchantCategory
  country_mismatch    — already derived in normalization (-1/0/1)
  has_device_id       — 1 if device_id is not null
  has_ip_address      — 1 if ip_address is not null
  has_billing_country — 1 if billing_country is not null
  has_shipping_country— 1 if shipping_country is not null
"""

from __future__ import annotations

import numpy as np
import pandas as pd

# Stable ordinal maps — order is arbitrary but must be frozen across train/inference.
# UNKNOWN / None always maps to 0 so missing values produce a consistent encoding.
_PAYMENT_METHOD_MAP: dict[str, int] = {
    "UNKNOWN":       0,
    "CARD":          1,
    "BANK_TRANSFER": 2,
    "WALLET":        3,
    "CRYPTO":        4,
}

_MERCHANT_CATEGORY_MAP: dict[str, int] = {
    "UNKNOWN":       0,
    "ELECTRONICS":   1,
    "APPAREL":       2,
    "DIGITAL_GOODS": 3,
    "TRAVEL":        4,
    "GROCERY":       5,
    "GAMING":        6,
    "FINANCIAL":     7,
    "MARKETPLACE":   8,
}


def add_transaction_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Compute transaction-level features and add them as new columns.

    Modifies df in-place (returns the same object for chaining).
    The input DataFrame must have been produced by normalization.normalize_transactions()
    so that log_amount, hour_of_day, day_of_week, and country_mismatch
    are already present.

    Parameters
    ----------
    df : normalized DataFrame from normalization.normalize_transactions()

    Returns
    -------
    df with additional feature columns appended.
    """
    # ── Calendar features ────────────────────────────────────────────────
    df["is_weekend"] = df["day_of_week"].isin({5, 6}).astype(np.int8)
    df["is_night"]   = df["hour_of_day"].between(0, 5).astype(np.int8)

    # ── Categorical encodings ─────────────────────────────────────────────
    df["payment_method_enc"] = (
        df["payment_method"]
        .fillna("UNKNOWN")
        .str.upper()
        .map(_PAYMENT_METHOD_MAP)
        .fillna(0)
        .astype(np.int8)
    )
    df["merchant_category_enc"] = (
        df["merchant_category"]
        .fillna("UNKNOWN")
        .str.upper()
        .map(_MERCHANT_CATEGORY_MAP)
        .fillna(0)
        .astype(np.int8)
    )

    # ── Missingness indicators ────────────────────────────────────────────
    df["has_device_id"]        = df["device_id"].notna().astype(np.int8)
    df["has_ip_address"]       = df["ip_address"].notna().astype(np.int8)
    df["has_billing_country"]  = df["billing_country"].notna().astype(np.int8)
    df["has_shipping_country"] = df["shipping_country"].notna().astype(np.int8)

    return df

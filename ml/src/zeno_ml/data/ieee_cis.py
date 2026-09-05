"""
IEEE-CIS Fraud Detection dataset loader and field mapping.

Dataset: https://www.kaggle.com/c/ieee-fraud-detection/data
Files needed (place in ml/data/raw/ieee-cis/):
  train_transaction.csv   — 590 540 rows, 394 columns
  train_identity.csv      — 144 233 rows, 41 columns  (optional join)

Column mapping to Zeno canonical schema
───────────────────────────────────────
IEEE-CIS field          Canonical field          Notes
──────────────────────  ───────────────────────  ────────────────────────────
TransactionID           transaction_id           string cast
TransactionDT           timestamp                seconds from reference epoch;
                                                 converted to sortable datetime
TransactionAmt          amount                   USD float
ProductCD               merchant_category        mapped via PRODUCT_CD_MAP
card4                   payment_method           mapped via CARD4_MAP
P_emaildomain           email_domain             as-is string
addr1                   billing_country          numeric postal area → None
                                                 (no reliable country mapping)
isFraud                 is_fraud                 bool — GROUND TRUTH, evaluation
                                                 only, never enters feature matrix

Synthetic / derived fields (not in source):
  merchant_id   — single constant "ieee-cis" (dataset has one implicit merchant)
  customer_id   — uid derived from card1+card2+card3+card4+addr1+addr2 hash
                  (IEEE-CIS does not provide a true customer ID)
  device_id     — DeviceInfo column from identity table if joined, else None
  ip_address    — id_30+id_31 OS/browser fingerprint is NOT an IP; set None
  data_source   — always DataSource.IEEE_CIS

LEAKAGE NOTES
─────────────
• TransactionDT is the only ordering signal — all temporal splits use it.
• isFraud is extracted into label_series and NEVER placed in the feature DataFrame.
• No post-transaction columns (refund amounts, future activity) exist in this
  dataset so refund-based features default to 0 / missing=1.
• Customer ID is synthetic (card hash) — behavioral features group by this
  synthetic ID.  This is documented as a dataset limitation.

MISSING DATA
────────────
IEEE-CIS has many sparse V-columns (V1–V339).  These are not part of the
Zeno canonical schema (they are payment-processor internal signals).
They are dropped here — the canonical feature pipeline operates on the
documented feature groups only.  This is intentional: the canonical pipeline
must work on any merchant dataset, not just IEEE-CIS-specific columns.
"""

from __future__ import annotations

import hashlib
import logging
from pathlib import Path
from typing import TYPE_CHECKING

import numpy as np
import pandas as pd

from zeno_ml.data.schema import DataSource, RawTransaction

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)

# ── Default data directory ────────────────────────────────────────────────
DEFAULT_RAW_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data" / "raw" / "ieee-cis"

# ── Reference epoch for TransactionDT ─────────────────────────────────────
# IEEE-CIS does not publish the exact reference date.  The community consensus
# is approximately 2017-11-30.  We use this as a constant baseline.
# The exact date does not affect relative temporal ordering (only wall-clock
# values), so the temporal split remains valid regardless of this assumption.
_IEEE_EPOCH = pd.Timestamp("2017-11-30", tz="UTC")

# ── Merchant ID for the single-tenant IEEE-CIS dataset ────────────────────
IEEE_MERCHANT_ID = "ieee-cis-benchmark"

# ── Product code → MerchantCategory mapping ──────────────────────────────
PRODUCT_CD_MAP: dict[str, str] = {
    "W": "DIGITAL_GOODS",   # web purchase
    "H": "APPAREL",          # home
    "C": "ELECTRONICS",      # consumer electronics
    "S": "MARKETPLACE",      # services
    "R": "MARKETPLACE",      # recurring
}

# ── card4 (card network) → PaymentMethod mapping ─────────────────────────
CARD4_MAP: dict[str, str] = {
    "visa":       "CARD",
    "mastercard": "CARD",
    "american express": "CARD",
    "discover":   "CARD",
}


# ─────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────

def load_ieee_cis(
    raw_dir: Path | str | None = None,
    identity_join: bool = True,
    max_rows: int | None = None,
) -> tuple[list[RawTransaction], pd.Series]:
    """
    Load the IEEE-CIS dataset and convert it to canonical RawTransaction objects.

    Parameters
    ----------
    raw_dir :
        Directory containing train_transaction.csv (and optionally
        train_identity.csv).  Defaults to ml/data/raw/ieee-cis/.
    identity_join :
        If True and train_identity.csv is present, join on TransactionID
        to extract device info.
    max_rows :
        Limit rows for development/testing.  None = load all.

    Returns
    -------
    (transactions, labels)
        transactions : list[RawTransaction]  — canonical objects, isFraud stripped
        labels       : pd.Series[bool]       — aligned to transactions, for eval only
    """
    raw_dir = Path(raw_dir or DEFAULT_RAW_DIR)
    tx_path = raw_dir / "train_transaction.csv"

    if not tx_path.exists():
        raise FileNotFoundError(
            f"IEEE-CIS transaction file not found: {tx_path}\n"
            f"Download from https://www.kaggle.com/c/ieee-fraud-detection/data\n"
            f"and place train_transaction.csv in {raw_dir}"
        )

    logger.info("Loading IEEE-CIS transactions from %s …", tx_path)
    tx_df = pd.read_csv(tx_path, nrows=max_rows)
    logger.info("Loaded %d rows, %d columns.", len(tx_df), len(tx_df.columns))

    # Optional identity join for device info
    id_df: pd.DataFrame | None = None
    if identity_join:
        id_path = raw_dir / "train_identity.csv"
        if id_path.exists():
            logger.info("Loading identity table from %s …", id_path)
            id_df = pd.read_csv(id_path)
            tx_df = tx_df.merge(id_df, on="TransactionID", how="left")
            logger.info("After identity join: %d rows.", len(tx_df))
        else:
            logger.info("Identity file not found — skipping join.")

    transactions, labels = _convert_to_canonical(tx_df)
    logger.info(
        "Converted %d transactions. Fraud rate: %.4f",
        len(transactions),
        labels.mean() if len(labels) > 0 else 0.0,
    )
    return transactions, labels


def load_ieee_cis_dataframe(
    raw_dir: Path | str | None = None,
    identity_join: bool = True,
    max_rows: int | None = None,
) -> tuple[pd.DataFrame, pd.Series]:
    """
    Like load_ieee_cis() but returns a raw pandas DataFrame (pre-canonical)
    for use in the training pipeline where we need direct DataFrame access
    for the temporal split before constructing RawTransaction objects.

    Returns
    -------
    (df, labels)
        df     : DataFrame with canonical-mapped columns + TransactionDT for sorting
        labels : pd.Series[bool] aligned to df.index
    """
    raw_dir = Path(raw_dir or DEFAULT_RAW_DIR)
    tx_path = raw_dir / "train_transaction.csv"

    if not tx_path.exists():
        raise FileNotFoundError(
            f"IEEE-CIS transaction file not found: {tx_path}\n"
            f"Download from https://www.kaggle.com/c/ieee-fraud-detection/data\n"
            f"and place train_transaction.csv in {raw_dir}"
        )

    logger.info("Loading IEEE-CIS transactions from %s …", tx_path)
    tx_df = pd.read_csv(tx_path, nrows=max_rows)

    id_df = None
    if identity_join:
        id_path = raw_dir / "train_identity.csv"
        if id_path.exists():
            id_df = pd.read_csv(id_path)
            tx_df = tx_df.merge(id_df, on="TransactionID", how="left")

    labels = tx_df["isFraud"].astype(bool)
    mapped = _map_columns(tx_df)
    mapped.index = tx_df.index
    return mapped, labels


# ─────────────────────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────────────────────

def _map_columns(tx_df: pd.DataFrame) -> pd.DataFrame:
    """
    Map IEEE-CIS columns to Zeno canonical column names.
    Returns a DataFrame with canonical field names; does NOT include isFraud.
    """
    df = pd.DataFrame()

    # ── Identifiers ───────────────────────────────────────────────────────
    df["transaction_id"] = tx_df["TransactionID"].astype(str)
    df["merchant_id"]    = IEEE_MERCHANT_ID
    df["customer_id"]    = _derive_customer_id(tx_df)

    # ── Timestamp ─────────────────────────────────────────────────────────
    # TransactionDT = seconds since reference epoch
    # We preserve the raw integer as well for temporal splitting
    df["transaction_dt"] = tx_df["TransactionDT"].astype(float)
    df["timestamp"]      = _dt_to_timestamp(tx_df["TransactionDT"])

    # ── Financial ─────────────────────────────────────────────────────────
    df["amount"]   = tx_df["TransactionAmt"].astype(float)
    df["currency"] = "USD"   # SYNTHETIC: IEEE-CIS is USD-denominated

    # ── Payment method ────────────────────────────────────────────────────
    df["payment_method"] = (
        tx_df["card4"]
        .fillna("UNKNOWN")
        .str.lower()
        .map(CARD4_MAP)
        .fillna("UNKNOWN")
    )

    # ── Device & network ──────────────────────────────────────────────────
    # DeviceInfo comes from identity join; may be absent
    if "DeviceInfo" in tx_df.columns:
        df["device_id"] = tx_df["DeviceInfo"].where(tx_df["DeviceInfo"].notna(), None)
    else:
        df["device_id"] = None

    # IEEE-CIS does not expose raw IP addresses
    df["ip_address"] = None   # SYNTHETIC: genuinely absent in dataset

    # ── Geography ─────────────────────────────────────────────────────────
    # addr1 is a numeric billing region code — not an ISO country code
    # We cannot reliably map it to ISO-3166 so we leave both as None
    df["billing_country"]  = None   # SYNTHETIC: not available in IEEE-CIS
    df["shipping_country"] = None   # SYNTHETIC: not available in IEEE-CIS

    # ── Merchant category ─────────────────────────────────────────────────
    df["merchant_category"] = (
        tx_df["ProductCD"]
        .fillna("UNKNOWN")
        .str.upper()
        .map(PRODUCT_CD_MAP)
        .fillna("UNKNOWN")
    )

    # ── Email ─────────────────────────────────────────────────────────────
    df["email_domain"] = tx_df.get("P_emaildomain", pd.Series(dtype=str)).where(
        tx_df.get("P_emaildomain", pd.Series(dtype=str)).notna(), other=None
    )

    # ── Refund fields ─────────────────────────────────────────────────────
    # IEEE-CIS does not include refund data
    df["is_refunded"]   = False   # SYNTHETIC: not available
    df["refund_amount"] = None

    # ── Data source ───────────────────────────────────────────────────────
    df["data_source"] = DataSource.IEEE_CIS.value

    return df


def _convert_to_canonical(
    tx_df: pd.DataFrame,
) -> tuple[list[RawTransaction], pd.Series]:
    """
    Convert a raw IEEE-CIS DataFrame into (RawTransaction list, label Series).
    isFraud is extracted into labels and never placed in the transaction objects.
    """
    labels = tx_df["isFraud"].astype(bool)
    mapped = _map_columns(tx_df)

    transactions: list[RawTransaction] = []
    for _, row in mapped.iterrows():
        try:
            tx = RawTransaction(
                transaction_id=row["transaction_id"],
                merchant_id=row["merchant_id"],
                customer_id=row["customer_id"],
                timestamp=row["timestamp"],
                amount=float(row["amount"]),
                currency=str(row["currency"]),
                payment_method=str(row["payment_method"]),
                device_id=row["device_id"] if pd.notna(row.get("device_id")) else None,
                ip_address=None,
                billing_country=None,
                shipping_country=None,
                merchant_category=str(row["merchant_category"]),
                email_domain=row["email_domain"] if pd.notna(row.get("email_domain")) else None,
                is_refunded=False,
                refund_amount=None,
                is_fraud=None,   # NEVER set from data — ground truth stays in labels
                data_source=DataSource.IEEE_CIS,
            )
            transactions.append(tx)
        except Exception as exc:  # noqa: BLE001
            logger.debug("Skipping row %s: %s", row.get("transaction_id"), exc)

    return transactions, labels.reset_index(drop=True)


def _derive_customer_id(tx_df: pd.DataFrame) -> pd.Series:
    """
    Derive a pseudo-customer ID from card attributes.

    IEEE-CIS has no explicit customer identifier.  We use a hash of
    card1, card2, card3, card4, addr1, addr2.  This is a dataset
    limitation: two different real customers with the same card attributes
    will appear as one pseudo-customer.  This is documented and accepted.
    """
    key_cols = ["card1", "card2", "card3", "card4", "addr1", "addr2"]
    existing = [c for c in key_cols if c in tx_df.columns]

    def hash_row(row: pd.Series) -> str:
        key = "|".join(str(row.get(c, "")) for c in existing)
        return "cust-" + hashlib.md5(key.encode()).hexdigest()[:12]  # noqa: S324

    return tx_df[existing].fillna("").apply(hash_row, axis=1)


def _dt_to_timestamp(dt_series: pd.Series) -> pd.Series:
    """
    Convert TransactionDT (seconds from reference epoch) to UTC datetime.
    """
    return dt_series.apply(
        lambda s: _IEEE_EPOCH + pd.Timedelta(seconds=float(s))
        if pd.notna(s) else _IEEE_EPOCH
    )

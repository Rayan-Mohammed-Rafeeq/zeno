"""
Temporal split utility.

Splits a dataset by time order into train / validation / test partitions.

DESIGN PRINCIPLES
─────────────────
1. Splitting is done by quantile of the ordering column (TransactionDT for
   IEEE-CIS, or timestamp for synthetic data), NOT by arbitrary wall-clock
   dates.  This makes the split reproducible on any dataset regardless of
   the actual time range.

2. Default proportions: train=0.70, val=0.15, test=0.15.
   These can be overridden but the sum must equal 1.0.

3. The test set is FROZEN after its boundaries are determined.  This module
   enforces that by returning a SplitResult dataclass whose test indices are
   recorded with a SHA-256 fingerprint.  Any code that touches the test set
   for anything other than final evaluation will violate this contract
   (enforced by tests in test_splits.py).

4. NO shuffle before splitting — temporal order must be preserved.
   A shuffle would allow the model to train on future information.

5. The split is deterministic given the same input ordering — no random
   seeds needed.

6. For the IEEE-CIS dataset, the ordering column is TransactionDT (integer
   seconds).  For the canonical DataFrame it is 'timestamp' (datetime).
   Both are supported via the `order_column` parameter.

SPLIT STRUCTURE (TIME →)
─────────────────────────
  ████████████████████████  ██████████████  ██████████████
         TRAIN (70%)          VAL (15%)        TEST (15%)
  ──────────────────────────────────────────────────────→
  oldest                                           newest
"""

from __future__ import annotations

import hashlib
import json
import logging
from dataclasses import dataclass, field
from typing import Any

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# Default split proportions
DEFAULT_TRAIN_FRAC: float = 0.70
DEFAULT_VAL_FRAC:   float = 0.15
DEFAULT_TEST_FRAC:  float = 0.15


@dataclass
class SplitResult:
    """
    Output of temporal_split().

    All index arrays reference positions in the original DataFrame
    (integer positional indices after sorting, not the DataFrame's own index).

    Attributes
    ----------
    train_idx, val_idx, test_idx :
        numpy arrays of integer positions.
    train_frac, val_frac, test_frac :
        Actual proportions after splitting (may differ slightly from
        requested due to rounding).
    order_column :
        Name of the column used for ordering.
    n_total, n_train, n_val, n_test :
        Row counts.
    test_fingerprint :
        SHA-256 of the sorted test indices.  Store this alongside model
        artefacts to verify the test set was never changed between
        threshold optimization and final evaluation.
    metadata :
        Arbitrary metadata dict (dataset name, version, etc.).
    """
    train_idx:        np.ndarray
    val_idx:          np.ndarray
    test_idx:         np.ndarray
    train_frac:       float
    val_frac:         float
    test_frac:        float
    order_column:     str
    n_total:          int
    n_train:          int
    n_val:            int
    n_test:           int
    test_fingerprint: str
    metadata:         dict[str, Any] = field(default_factory=dict)

    # ── Convenience subset methods ────────────────────────────────────────

    def apply(self, df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
        """Return (train_df, val_df, test_df) by positional indexing."""
        return (
            df.iloc[self.train_idx].reset_index(drop=True),
            df.iloc[self.val_idx].reset_index(drop=True),
            df.iloc[self.test_idx].reset_index(drop=True),
        )

    def apply_arrays(
        self,
        X: np.ndarray,
        y: np.ndarray,
    ) -> tuple[
        tuple[np.ndarray, np.ndarray],
        tuple[np.ndarray, np.ndarray],
        tuple[np.ndarray, np.ndarray],
    ]:
        """Return ((X_tr,y_tr), (X_va,y_va), (X_te,y_te))."""
        return (
            (X[self.train_idx], y[self.train_idx]),
            (X[self.val_idx],   y[self.val_idx]),
            (X[self.test_idx],  y[self.test_idx]),
        )

    def summary(self) -> str:
        lines = [
            "Temporal Split",
            f"  Order column : {self.order_column}",
            f"  Total rows   : {self.n_total:,}",
            f"  Train        : {self.n_train:,}  ({self.train_frac:.1%})",
            f"  Validation   : {self.n_val:,}  ({self.val_frac:.1%})",
            f"  Test (frozen): {self.n_test:,}  ({self.test_frac:.1%})",
            f"  Test fingerprint: {self.test_fingerprint[:16]}…",
        ]
        return "\n".join(lines)

    def to_dict(self) -> dict[str, Any]:
        return {
            "order_column":     self.order_column,
            "n_total":          self.n_total,
            "n_train":          self.n_train,
            "n_val":            self.n_val,
            "n_test":           self.n_test,
            "train_frac":       round(self.train_frac, 4),
            "val_frac":         round(self.val_frac, 4),
            "test_frac":        round(self.test_frac, 4),
            "test_fingerprint": self.test_fingerprint,
            "metadata":         self.metadata,
        }


def temporal_split(
    df: pd.DataFrame,
    order_column: str = "transaction_dt",
    train_frac: float = DEFAULT_TRAIN_FRAC,
    val_frac:   float = DEFAULT_VAL_FRAC,
    test_frac:  float = DEFAULT_TEST_FRAC,
    metadata:   dict[str, Any] | None = None,
) -> SplitResult:
    """
    Split a DataFrame into train / validation / test by temporal order.

    Parameters
    ----------
    df :
        DataFrame to split.  Must contain order_column.
    order_column :
        Column used for ordering.  'transaction_dt' for IEEE-CIS (integer),
        'timestamp' for canonical datetime DataFrames.
    train_frac, val_frac, test_frac :
        Proportions.  Must sum to 1.0 (tolerance 1e-6).

    Returns
    -------
    SplitResult

    Raises
    ------
    ValueError :
        If fractions don't sum to 1, order_column absent, or df is empty.
    """
    _validate_fractions(train_frac, val_frac, test_frac)

    if order_column not in df.columns:
        raise ValueError(
            f"Order column '{order_column}' not found in DataFrame. "
            f"Available: {list(df.columns)}"
        )
    if len(df) == 0:
        raise ValueError("Cannot split an empty DataFrame.")

    # ── Sort by time (stable, no shuffle) ────────────────────────────────
    sorted_positions = df[order_column].argsort(kind="stable").values
    n = len(sorted_positions)

    # ── Compute split boundaries by count ────────────────────────────────
    n_train = int(np.floor(n * train_frac))
    n_val   = int(np.floor(n * val_frac))
    n_test  = n - n_train - n_val   # absorb rounding remainder into test

    if n_train == 0 or n_val == 0 or n_test == 0:
        raise ValueError(
            f"Split produced an empty partition with n={n}, "
            f"train={n_train}, val={n_val}, test={n_test}. "
            "Use a larger dataset or adjust fractions."
        )

    train_idx = sorted_positions[:n_train]
    val_idx   = sorted_positions[n_train : n_train + n_val]
    test_idx  = sorted_positions[n_train + n_val :]

    # ── Verify temporal ordering within splits (no overlap) ───────────────
    _assert_temporal_order(df, order_column, train_idx, val_idx, test_idx)

    # ── Fingerprint the test set ──────────────────────────────────────────
    test_fingerprint = _fingerprint_values(df, order_column, test_idx)

    result = SplitResult(
        train_idx=train_idx,
        val_idx=val_idx,
        test_idx=test_idx,
        train_frac=n_train / n,
        val_frac=n_val / n,
        test_frac=n_test / n,
        order_column=order_column,
        n_total=n,
        n_train=n_train,
        n_val=n_val,
        n_test=n_test,
        test_fingerprint=test_fingerprint,
        metadata=metadata or {},
    )

    logger.info(result.summary())
    return result


def temporal_split_labels(
    labels: pd.Series,
    split: SplitResult,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Apply a SplitResult to a label Series.

    Returns (y_train, y_val, y_test) as boolean numpy arrays.
    """
    y = labels.values.astype(bool)
    return y[split.train_idx], y[split.val_idx], y[split.test_idx]


def compute_fraud_rates(
    y_train: np.ndarray,
    y_val:   np.ndarray,
    y_test:  np.ndarray,
) -> dict[str, float]:
    """Report fraud rates across all three splits for documentation purposes."""
    def rate(y: np.ndarray) -> float:
        return float(y.mean()) if len(y) > 0 else 0.0

    return {
        "train_fraud_rate": round(rate(y_train), 6),
        "val_fraud_rate":   round(rate(y_val),   6),
        "test_fraud_rate":  round(rate(y_test),  6),
    }


# ─────────────────────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────────────────────

def _validate_fractions(
    train_frac: float,
    val_frac:   float,
    test_frac:  float,
) -> None:
    total = train_frac + val_frac + test_frac
    if abs(total - 1.0) > 1e-6:
        raise ValueError(
            f"train_frac + val_frac + test_frac must equal 1.0, got {total:.6f}"
        )
    for name, v in [("train_frac", train_frac), ("val_frac", val_frac), ("test_frac", test_frac)]:
        if not (0.0 < v < 1.0):
            raise ValueError(f"{name}={v} must be in (0, 1).")


def _assert_temporal_order(
    df: pd.DataFrame,
    order_column: str,
    train_idx: np.ndarray,
    val_idx: np.ndarray,
    test_idx: np.ndarray,
) -> None:
    """
    Assert that max(train) <= min(val) <= min(test).

    This is the core no-future-leakage invariant for temporal splitting.
    Raises AssertionError if violated.
    """
    col = df[order_column]
    train_max = col.iloc[train_idx].max()
    val_min   = col.iloc[val_idx].min()
    val_max   = col.iloc[val_idx].max()
    test_min  = col.iloc[test_idx].min()

    assert train_max <= val_min, (
        f"TEMPORAL LEAKAGE: train set contains values ({train_max}) "
        f"after the start of validation ({val_min})."
    )
    assert val_max <= test_min, (
        f"TEMPORAL LEAKAGE: validation set contains values ({val_max}) "
        f"after the start of test ({test_min})."
    )


def _fingerprint_indices(idx: np.ndarray) -> str:
    """SHA-256 of sorted index array — used to verify test set integrity."""
    sorted_idx = np.sort(idx)
    return hashlib.sha256(sorted_idx.tobytes()).hexdigest()


def _fingerprint_values(df: pd.DataFrame, order_column: str, idx: np.ndarray) -> str:
    """
    SHA-256 of the sorted order-column VALUES of the test rows.

    Using values (not positional indices) means the fingerprint changes
    when the underlying data changes, even if the dataset size is the same.
    This is the correct integrity check for the test set.
    """
    values = np.sort(df[order_column].iloc[idx].values)
    # Convert to float64 bytes for consistent hashing across dtypes
    try:
        values_bytes = values.astype(np.float64).tobytes()
    except (TypeError, ValueError):
        # Fallback for non-numeric columns (e.g. datetime): use string repr
        values_bytes = str(values.tolist()).encode()
    return hashlib.sha256(values_bytes).hexdigest()

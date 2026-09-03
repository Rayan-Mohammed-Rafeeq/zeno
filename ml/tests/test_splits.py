"""
Tests for temporal split utility.

Verifies:
  - Temporal ordering is preserved (no future data in earlier splits)
  - Proportions are approximately correct
  - No rows are lost or duplicated across splits
  - Test fingerprint is deterministic and changes when data changes
  - Empty partition raises ValueError
  - Fraction validation catches bad inputs
  - apply() and apply_arrays() return correct shapes
  - The test set is frozen (fingerprint matches after re-split)
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from niro_ml.models.splits import (
    SplitResult,
    compute_fraud_rates,
    temporal_split,
    temporal_split_labels,
)


# ── Fixtures ──────────────────────────────────────────────────────────────

@pytest.fixture
def sequential_df():
    """100 rows with sequential transaction_dt values."""
    n = 100
    return pd.DataFrame({
        "transaction_dt": np.arange(n, dtype=float),
        "amount":         np.random.default_rng(0).uniform(10, 500, n),
    })


@pytest.fixture
def shuffled_df():
    """100 rows with transaction_dt shuffled (unsorted input)."""
    n = 100
    rng = np.random.default_rng(1)
    dt = np.arange(n, dtype=float)
    rng.shuffle(dt)
    return pd.DataFrame({"transaction_dt": dt, "amount": rng.uniform(10, 500, n)})


@pytest.fixture
def large_df():
    """10 000 rows — tests proportion accuracy."""
    n = 10_000
    return pd.DataFrame({
        "transaction_dt": np.arange(n, dtype=float),
        "value":          np.ones(n),
    })


@pytest.fixture
def labels_100():
    rng = np.random.default_rng(42)
    return pd.Series((rng.random(100) < 0.05).astype(bool))


# ── Temporal ordering ──────────────────────────────────────────────────────

class TestTemporalOrdering:

    def test_train_ends_before_val_starts(self, sequential_df):
        split = temporal_split(sequential_df)
        df = sequential_df
        train_max = df.iloc[split.train_idx]["transaction_dt"].max()
        val_min   = df.iloc[split.val_idx]["transaction_dt"].min()
        assert train_max <= val_min, (
            f"TEMPORAL LEAKAGE: train max {train_max} > val min {val_min}"
        )

    def test_val_ends_before_test_starts(self, sequential_df):
        split = temporal_split(sequential_df)
        df = sequential_df
        val_max  = df.iloc[split.val_idx]["transaction_dt"].max()
        test_min = df.iloc[split.test_idx]["transaction_dt"].min()
        assert val_max <= test_min, (
            f"TEMPORAL LEAKAGE: val max {val_max} > test min {test_min}"
        )

    def test_shuffled_input_still_ordered(self, shuffled_df):
        """Even with shuffled input, splits must respect temporal order."""
        split = temporal_split(shuffled_df)
        df = shuffled_df
        train_max = df.iloc[split.train_idx]["transaction_dt"].max()
        val_min   = df.iloc[split.val_idx]["transaction_dt"].min()
        val_max   = df.iloc[split.val_idx]["transaction_dt"].max()
        test_min  = df.iloc[split.test_idx]["transaction_dt"].min()
        assert train_max <= val_min
        assert val_max   <= test_min

    def test_oldest_records_in_train(self, sequential_df):
        """The oldest transactions must be in the training set."""
        split = temporal_split(sequential_df)
        df = sequential_df
        overall_min = df["transaction_dt"].min()
        train_min   = df.iloc[split.train_idx]["transaction_dt"].min()
        assert train_min == overall_min

    def test_newest_records_in_test(self, sequential_df):
        """The newest transactions must be in the test set."""
        split = temporal_split(sequential_df)
        df = sequential_df
        overall_max = df["transaction_dt"].max()
        test_max    = df.iloc[split.test_idx]["transaction_dt"].max()
        assert test_max == overall_max

    def test_no_row_overlap_between_splits(self, sequential_df):
        """Each row must appear in exactly one split."""
        split = temporal_split(sequential_df)
        train_set = set(split.train_idx.tolist())
        val_set   = set(split.val_idx.tolist())
        test_set  = set(split.test_idx.tolist())
        assert len(train_set & val_set)  == 0, "Overlap between train and val"
        assert len(train_set & test_set) == 0, "Overlap between train and test"
        assert len(val_set   & test_set) == 0, "Overlap between val and test"

    def test_all_rows_accounted_for(self, sequential_df):
        """Total rows across all splits must equal input rows."""
        split = temporal_split(sequential_df)
        total = split.n_train + split.n_val + split.n_test
        assert total == len(sequential_df)


# ── Proportions ───────────────────────────────────────────────────────────

class TestProportions:

    def test_default_proportions_approx(self, large_df):
        """Default 70/15/15 split proportions should be within 1% of target."""
        split = temporal_split(large_df)
        assert abs(split.train_frac - 0.70) < 0.01
        assert abs(split.val_frac   - 0.15) < 0.01
        assert abs(split.test_frac  - 0.15) < 0.01

    def test_custom_proportions(self, large_df):
        split = temporal_split(large_df, train_frac=0.8, val_frac=0.1, test_frac=0.1)
        assert abs(split.train_frac - 0.80) < 0.01
        assert abs(split.val_frac   - 0.10) < 0.01
        assert abs(split.test_frac  - 0.10) < 0.01

    def test_counts_sum_to_total(self, large_df):
        split = temporal_split(large_df)
        assert split.n_train + split.n_val + split.n_test == split.n_total

    def test_fractions_sum_to_one(self, large_df):
        split = temporal_split(large_df)
        total_frac = split.train_frac + split.val_frac + split.test_frac
        assert abs(total_frac - 1.0) < 1e-6


# ── Input validation ──────────────────────────────────────────────────────

class TestInputValidation:

    def test_fractions_not_summing_to_one_raises(self, sequential_df):
        with pytest.raises(ValueError, match="must equal 1.0"):
            temporal_split(sequential_df, train_frac=0.6, val_frac=0.2, test_frac=0.3)

    def test_zero_fraction_raises(self, sequential_df):
        with pytest.raises(ValueError):
            temporal_split(sequential_df, train_frac=0.0, val_frac=0.5, test_frac=0.5)

    def test_missing_order_column_raises(self, sequential_df):
        with pytest.raises(ValueError, match="not found"):
            temporal_split(sequential_df, order_column="nonexistent_col")

    def test_empty_dataframe_raises(self):
        df = pd.DataFrame({"transaction_dt": pd.Series([], dtype=float)})
        with pytest.raises(ValueError, match="empty"):
            temporal_split(df)

    def test_too_small_for_split_raises(self):
        """A dataset of 2 rows can't produce 3 non-empty splits."""
        df = pd.DataFrame({"transaction_dt": [1.0, 2.0]})
        with pytest.raises(ValueError, match="empty partition"):
            temporal_split(df)


# ── Test fingerprint ──────────────────────────────────────────────────────

class TestFingerprint:

    def test_fingerprint_deterministic(self, sequential_df):
        """Same data must produce the same fingerprint every time."""
        split1 = temporal_split(sequential_df)
        split2 = temporal_split(sequential_df)
        assert split1.test_fingerprint == split2.test_fingerprint

    def test_fingerprint_changes_with_different_data(self):
        """Different data must produce different fingerprints."""
        df1 = pd.DataFrame({"transaction_dt": np.arange(100, dtype=float)})
        df2 = pd.DataFrame({"transaction_dt": np.arange(1, 101, dtype=float)})
        split1 = temporal_split(df1)
        split2 = temporal_split(df2)
        assert split1.test_fingerprint != split2.test_fingerprint

    def test_fingerprint_is_64_hex_chars(self, sequential_df):
        """SHA-256 produces 64 hex characters."""
        split = temporal_split(sequential_df)
        assert len(split.test_fingerprint) == 64
        assert all(c in "0123456789abcdef" for c in split.test_fingerprint)

    def test_fingerprint_in_to_dict(self, sequential_df):
        split = temporal_split(sequential_df)
        d = split.to_dict()
        assert "test_fingerprint" in d
        assert d["test_fingerprint"] == split.test_fingerprint


# ── apply() and label helpers ─────────────────────────────────────────────

class TestApplyHelpers:

    def test_apply_returns_correct_row_counts(self, sequential_df):
        split = temporal_split(sequential_df)
        tr, va, te = split.apply(sequential_df)
        assert len(tr) == split.n_train
        assert len(va) == split.n_val
        assert len(te) == split.n_test

    def test_apply_resets_index(self, sequential_df):
        split = temporal_split(sequential_df)
        tr, va, te = split.apply(sequential_df)
        assert list(tr.index) == list(range(len(tr)))
        assert list(te.index) == list(range(len(te)))

    def test_apply_arrays_correct_shapes(self, sequential_df):
        split = temporal_split(sequential_df)
        X = sequential_df.values
        y = np.zeros(len(sequential_df), dtype=bool)
        (X_tr, y_tr), (X_va, y_va), (X_te, y_te) = split.apply_arrays(X, y)
        assert len(X_tr) == split.n_train
        assert len(X_va) == split.n_val
        assert len(X_te) == split.n_test

    def test_temporal_split_labels_correct_length(self, sequential_df, labels_100):
        split = temporal_split(sequential_df)
        y_tr, y_va, y_te = temporal_split_labels(labels_100, split)
        assert len(y_tr) == split.n_train
        assert len(y_va) == split.n_val
        assert len(y_te) == split.n_test

    def test_temporal_split_labels_sum_to_total(self, sequential_df, labels_100):
        split = temporal_split(sequential_df)
        y_tr, y_va, y_te = temporal_split_labels(labels_100, split)
        assert len(y_tr) + len(y_va) + len(y_te) == len(labels_100)

    def test_fraud_rates_dict_keys(self, sequential_df, labels_100):
        split = temporal_split(sequential_df)
        y_tr, y_va, y_te = temporal_split_labels(labels_100, split)
        rates = compute_fraud_rates(y_tr, y_va, y_te)
        assert "train_fraud_rate" in rates
        assert "val_fraud_rate"   in rates
        assert "test_fraud_rate"  in rates

    def test_summary_string_contains_counts(self, sequential_df):
        split = temporal_split(sequential_df)
        summary = split.summary()
        assert str(split.n_train) in summary
        assert str(split.n_test)  in summary

    def test_to_dict_serialisable(self, sequential_df):
        import json
        split = temporal_split(sequential_df)
        json.dumps(split.to_dict())   # must not raise


# ── Timestamp column support (canonical DataFrame) ────────────────────────

class TestTimestampColumn:

    def test_split_works_with_timestamp_column(self):
        """
        The canonical normalized DataFrame uses 'timestamp' (datetime),
        not 'transaction_dt' (int).  temporal_split() must work with both.
        """
        n = 200
        df = pd.DataFrame({
            "timestamp": pd.date_range("2024-01-01", periods=n, freq="h", tz="UTC"),
            "amount":    np.ones(n),
        })
        split = temporal_split(df, order_column="timestamp")
        assert split.n_train + split.n_val + split.n_test == n

        # Temporal ordering must hold for datetime too
        ts_train_max = df.iloc[split.train_idx]["timestamp"].max()
        ts_val_min   = df.iloc[split.val_idx]["timestamp"].min()
        assert ts_train_max <= ts_val_min

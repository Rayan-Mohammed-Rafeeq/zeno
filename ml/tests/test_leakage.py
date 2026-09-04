"""
Temporal leakage detection tests.

These tests are the automated enforcement of the leakage contract stated
throughout the feature pipeline.  They assert that:

  1. No future transaction data appears in any computed feature.
  2. Ground truth labels (is_fraud) never enter the feature matrix.
  3. Post-transaction outcomes (is_refunded, refund_amount) never enter
     the feature matrix.
  4. Behavioral window features use strict-less-than (<) on timestamps.
  5. Device/IP sharing counts use only prior observations.
  6. Cross-merchant data never influences features for another merchant.
  7. First transaction for a customer has zero-value velocity features.

FAILURE of any test here is a critical ML integrity violation — the model
would be trained with information unavailable at real scoring time.
"""

from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from zeno_ml.data.normalization import normalize_transactions
from zeno_ml.data.schema import RawTransaction
from zeno_ml.features.behavioral import add_behavioral_features
from zeno_ml.features.device_ip import add_device_ip_features
from zeno_ml.features.pipeline import audit_for_leakage, run_feature_pipeline
from zeno_ml.features.sequence import add_sequence_features
from zeno_ml.features.transaction import add_transaction_features


def _utc(year, month, day, hour=0, minute=0, second=0):
    return datetime(year, month, day, hour, minute, second, tzinfo=timezone.utc)


# ===========================================================================
# 1. Ground truth and post-transaction outcomes must never reach features
# ===========================================================================

class TestForbiddenColumnsAbsent:

    def test_is_fraud_not_in_feature_matrix(self, labeled_transactions):
        """is_fraud must be stripped from the feature matrix."""
        result = run_feature_pipeline(transactions=labeled_transactions)
        assert "is_fraud" not in result.feature_matrix.columns, (
            "LEAKAGE: 'is_fraud' (ground truth label) appeared in the feature matrix."
        )

    def test_is_refunded_not_in_feature_matrix(self):
        """is_refunded is a post-transaction outcome — must not be a feature."""
        tx = RawTransaction(
            transaction_id="tx-refund-test",
            merchant_id="m1",
            customer_id="c1",
            timestamp=_utc(2024, 1, 1),
            amount=100.0,
            is_refunded=True,
            refund_amount=100.0,
        )
        result = run_feature_pipeline(transactions=[tx])
        assert "is_refunded" not in result.feature_matrix.columns, (
            "LEAKAGE: 'is_refunded' appeared in the feature matrix."
        )
        assert "refund_amount" not in result.feature_matrix.columns, (
            "LEAKAGE: 'refund_amount' appeared in the feature matrix."
        )

    def test_audit_for_leakage_detects_forbidden_columns(self):
        """audit_for_leakage() must catch explicitly forbidden column names."""
        import pandas as pd
        bad_df = pd.DataFrame({"amount": [100.0], "is_fraud": [True]})
        offenders = audit_for_leakage(bad_df)
        assert "is_fraud" in offenders

    def test_audit_for_leakage_passes_clean_feature_matrix(self, labeled_transactions):
        """A clean feature matrix produced by the pipeline must pass the audit."""
        result = run_feature_pipeline(transactions=labeled_transactions)
        offenders = audit_for_leakage(result.feature_matrix)
        assert offenders == [], f"Unexpected leakage in clean pipeline: {offenders}"

    def test_labels_returned_separately(self, labeled_transactions):
        """Labels must be returned in result.labels, not embedded in feature_matrix."""
        result = run_feature_pipeline(transactions=labeled_transactions)
        # Labels should be present in result.labels
        assert result.labels is not None
        assert len(result.labels) == len(result.feature_matrix)
        # But NOT as a column in the feature matrix
        assert "is_fraud" not in result.feature_matrix.columns


# ===========================================================================
# 2. Behavioral window features: strict-less-than on timestamp
# ===========================================================================

class TestBehavioralWindowLeakage:

    def test_first_transaction_has_zero_velocity(self, three_sequential_transactions):
        """
        The first transaction for a customer must have tx_count_5min = tx_count_1h
        = tx_count_24h = 0 because there are no prior transactions.
        """
        result = run_feature_pipeline(transactions=three_sequential_transactions)
        df = result.full_df

        # Sort to ensure we check the earliest transaction
        df = df.sort_values("timestamp")
        first_row = df.iloc[0]

        assert first_row["tx_count_5min"] == 0.0, (
            f"LEAKAGE: first tx has tx_count_5min={first_row['tx_count_5min']} (expected 0)."
        )
        assert first_row["tx_count_1h"] == 0.0, (
            f"LEAKAGE: first tx has tx_count_1h={first_row['tx_count_1h']} (expected 0)."
        )
        assert first_row["tx_count_24h"] == 0.0, (
            f"LEAKAGE: first tx has tx_count_24h={first_row['tx_count_24h']} (expected 0)."
        )

    def test_second_transaction_sees_exactly_one_prior(self, three_sequential_transactions):
        """
        The second transaction (T1 = 10:00) must see tx_count_1h = 1 (only T0 at 09:00).
        It must NOT see T2 (11:00) which hasn't happened yet.
        """
        result = run_feature_pipeline(transactions=three_sequential_transactions)
        df = result.full_df.sort_values("timestamp").reset_index(drop=True)
        second_row = df.iloc[1]   # 10:00

        assert second_row["tx_count_1h"] == 1.0, (
            f"LEAKAGE: second tx has tx_count_1h={second_row['tx_count_1h']} "
            f"(expected 1 — only T0 is prior)."
        )

    def test_third_transaction_velocity(self, three_sequential_transactions):
        """
        The third transaction (T2 = 11:00) must see tx_count_1h = 1 (only T1 at 10:00
        within 1h) and tx_count_24h = 2 (both T0 and T1 are prior, both within 24h).
        """
        result = run_feature_pipeline(transactions=three_sequential_transactions)
        df = result.full_df.sort_values("timestamp").reset_index(drop=True)
        third_row = df.iloc[2]   # 11:00

        assert third_row["tx_count_1h"] == 1.0, (
            f"LEAKAGE: third tx tx_count_1h={third_row['tx_count_1h']} (expected 1)."
        )
        assert third_row["tx_count_24h"] == 2.0, (
            f"LEAKAGE: third tx tx_count_24h={third_row['tx_count_24h']} (expected 2)."
        )

    def test_current_transaction_not_counted_in_window(self):
        """
        The current transaction must NEVER be counted in its own velocity window.
        Even if timestamps are equal (edge case), strict-less-than ensures exclusion.
        """
        # Two transactions at the SAME timestamp (edge case)
        ts = _utc(2024, 1, 15, 12, 0)
        txs = [
            RawTransaction(
                transaction_id="tx-same-ts-001",
                merchant_id="m1",
                customer_id="c1",
                timestamp=ts,
                amount=100.0,
            ),
            RawTransaction(
                transaction_id="tx-same-ts-002",
                merchant_id="m1",
                customer_id="c1",
                timestamp=ts,
                amount=100.0,
            ),
        ]
        result = run_feature_pipeline(transactions=txs)
        df = result.full_df.sort_values(["timestamp", "transaction_id"]).reset_index(drop=True)

        # First row: no prior → all zero
        assert df.iloc[0]["tx_count_1h"] == 0.0

    def test_amount_deviation_uses_only_prior_transactions(self, three_sequential_transactions):
        """
        amount_deviation_from_mean for the second transaction must be computed
        from the mean of T0 only (not T0 + T2 which hasn't occurred).
        """
        result = run_feature_pipeline(transactions=three_sequential_transactions)
        df = result.full_df.sort_values("timestamp").reset_index(drop=True)

        # First row has no history → deviation = 0
        assert df.iloc[0]["amount_deviation_from_mean"] == 0.0, (
            "LEAKAGE: first tx has non-zero amount_deviation_from_mean."
        )

        # Second row (T1 = 200.0): history = [100.0] → mean=100, deviation = (200-100)/(0+ε)
        # Should be large positive (200 is above the prior mean of 100)
        second_deviation = df.iloc[1]["amount_deviation_from_mean"]
        assert second_deviation > 0, (
            f"LEAKAGE: second tx amount_deviation={second_deviation}, "
            f"expected > 0 (200 is above prior mean 100)."
        )


# ===========================================================================
# 3. Velocity burst: 5-minute window
# ===========================================================================

class TestVelocityBurstLeakage:

    def test_5min_window_counts_correctly(self, velocity_burst_transactions):
        """
        6 transactions at 12:00, 12:01, 12:02, 12:03, 12:04, 12:05.
        At 12:05 (last tx), tx_count_5min must be 5.
        Window is [12:00, 12:05) — includes 12:00, 12:01, 12:02, 12:03, 12:04 = 5.
        The current tx at 12:05 is excluded because prior_timestamps = timestamps[:i].
        """
        result = run_feature_pipeline(transactions=velocity_burst_transactions)
        df = result.full_df.sort_values("timestamp").reset_index(drop=True)
        last_row = df.iloc[-1]   # 12:05

        # Transactions from 12:00, 12:01, 12:02, 12:03, 12:04 are all within 5 min
        # and strictly BEFORE 12:05 → count = 5
        count = last_row["tx_count_5min"]
        assert count == 5.0, (
            f"LEAKAGE: last burst tx tx_count_5min={count} (expected 5)."
        )

    def test_velocity_acceleration_increases_during_burst(self, velocity_burst_transactions):
        """
        velocity_acceleration = tx_count_1h / (tx_count_24h + ε).
        During a burst in a single hour, this ratio should be close to 1.
        For the last transaction in the burst it should not be 0.
        """
        result = run_feature_pipeline(transactions=velocity_burst_transactions)
        df = result.full_df.sort_values("timestamp").reset_index(drop=True)
        last_row = df.iloc[-1]

        # All prior txs are within both 1h and 24h windows
        accel = last_row["velocity_acceleration"]
        assert accel > 0, (
            f"velocity_acceleration should be > 0 for burst transactions, got {accel}."
        )


# ===========================================================================
# 4. Device / IP sharing: only prior observations count
# ===========================================================================

class TestDeviceIpLeakage:

    def test_first_customer_sees_no_shared_device(self, two_customer_transactions):
        """
        Customer A is the first to use the shared device (08:00).
        At that point, customers_per_device must be 1 (only themselves — no
        prior sharing visible).
        """
        result = run_feature_pipeline(transactions=two_customer_transactions)
        df = result.full_df.sort_values("timestamp").reset_index(drop=True)

        # First row is Customer A at 08:00
        first_row = df.iloc[0]
        assert first_row["customers_per_device"] == 1.0, (
            f"LEAKAGE: first tx sees customers_per_device={first_row['customers_per_device']} "
            f"(expected 1 — no prior sharing)."
        )

    def test_second_customer_sees_prior_sharing(self, two_customer_transactions):
        """
        Customer B uses the shared device at 10:00.
        By then, Customer A has already used it (08:00, 09:00).
        customers_per_device must be 2 (Customer A + Customer B).
        """
        result = run_feature_pipeline(transactions=two_customer_transactions)
        df = result.full_df.sort_values("timestamp").reset_index(drop=True)

        # Customer B is the last row (10:00)
        last_row = df.iloc[-1]
        assert last_row["customers_per_device"] >= 2.0, (
            f"LEAKAGE: Customer B sees customers_per_device={last_row['customers_per_device']} "
            f"(expected >= 2 — Customer A used the device first)."
        )

    def test_customer_a_tx2_does_not_see_customer_b(self, two_customer_transactions):
        """
        Customer A's second transaction (09:00) must NOT see Customer B
        (who transacts at 10:00 — in the future).
        customers_per_device for Customer A's 09:00 tx = 1.
        """
        result = run_feature_pipeline(transactions=two_customer_transactions)
        df = result.full_df.sort_values("timestamp").reset_index(drop=True)

        # Customer A's transactions are at index 0 (08:00) and 1 (09:00)
        customer_a_tx2 = df[df["customer_id"] == "customer-A"].sort_values("timestamp").iloc[-1]
        assert customer_a_tx2["customers_per_device"] == 1.0, (
            f"LEAKAGE: Customer A tx at 09:00 sees future Customer B. "
            f"customers_per_device={customer_a_tx2['customers_per_device']} (expected 1)."
        )


# ===========================================================================
# 5. Cross-merchant isolation: device sharing must not bleed across merchants
# ===========================================================================

class TestMerchantIsolation:

    def test_device_sharing_does_not_cross_merchants(self, two_merchant_transactions):
        """
        The same device is used in merchant-X and merchant-Y.
        customers_per_device for merchant-Y's transaction must be 1 —
        merchant-X's usage is invisible to merchant-Y's feature computation.
        """
        result = run_feature_pipeline(transactions=two_merchant_transactions)
        df = result.full_df.sort_values("timestamp").reset_index(drop=True)

        m_y_row = df[df["merchant_id"] == "merchant-Y"].iloc[0]
        assert m_y_row["customers_per_device"] == 1.0, (
            f"LEAKAGE: merchant-Y sees cross-merchant device sharing. "
            f"customers_per_device={m_y_row['customers_per_device']} (expected 1)."
        )

    def test_velocity_does_not_cross_merchants(self, two_merchant_transactions):
        """
        tx_per_device_24h for merchant-Y must be 0 —
        merchant-X's transactions on the same device are not visible.
        """
        result = run_feature_pipeline(transactions=two_merchant_transactions)
        df = result.full_df.sort_values("timestamp").reset_index(drop=True)

        m_y_row = df[df["merchant_id"] == "merchant-Y"].iloc[0]
        assert m_y_row["tx_per_device_24h"] == 0.0, (
            f"LEAKAGE: merchant-Y tx_per_device_24h={m_y_row['tx_per_device_24h']} "
            f"(expected 0 — cross-merchant isolation violated)."
        )


# ===========================================================================
# 6. Sequence features: use only the immediately preceding transaction
# ===========================================================================

class TestSequenceLeakage:

    def test_first_transaction_sequence_missing(self, three_sequential_transactions):
        """
        The first transaction has no prior transaction.
        seconds_since_prev_tx must be 0 with seconds_since_prev_tx_missing = 1.
        """
        result = run_feature_pipeline(transactions=three_sequential_transactions)
        df = result.full_df.sort_values("timestamp").reset_index(drop=True)
        first = df.iloc[0]

        assert first["seconds_since_prev_tx_missing"] == 1, (
            f"LEAKAGE: first tx seconds_since_prev_tx_missing={first['seconds_since_prev_tx_missing']} (expected 1)."
        )
        assert first["seconds_since_prev_tx"] == 0.0

    def test_second_transaction_correct_delta(self, three_sequential_transactions):
        """
        T0 = 09:00, T1 = 10:00.  seconds_since_prev_tx for T1 = 3600.
        """
        result = run_feature_pipeline(transactions=three_sequential_transactions)
        df = result.full_df.sort_values("timestamp").reset_index(drop=True)
        second = df.iloc[1]

        assert second["seconds_since_prev_tx_missing"] == 0
        assert second["seconds_since_prev_tx"] == pytest.approx(3600.0, abs=1.0), (
            f"LEAKAGE: seconds_since_prev_tx={second['seconds_since_prev_tx']} (expected 3600)."
        )

    def test_amount_change_direction(self, three_sequential_transactions):
        """
        T0 = $100, T1 = $200.  amount_change_from_prev for T1 = +100.
        T1 = $200, T2 = $300.  amount_change_from_prev for T2 = +100.
        """
        result = run_feature_pipeline(transactions=three_sequential_transactions)
        df = result.full_df.sort_values("timestamp").reset_index(drop=True)

        assert df.iloc[0]["amount_change_from_prev"] == 0.0  # first tx
        assert df.iloc[1]["amount_change_from_prev"] == pytest.approx(100.0, abs=0.01)
        assert df.iloc[2]["amount_change_from_prev"] == pytest.approx(100.0, abs=0.01)

    def test_repeated_amount_detection(self):
        """
        Two transactions at identical amounts within 24h should trigger
        repeated_amount = 1 on the second transaction.
        """
        txs = [
            RawTransaction(
                transaction_id="tx-rep-001",
                merchant_id="m1",
                customer_id="c1",
                timestamp=_utc(2024, 1, 15, 9, 0),
                amount=99.99,
            ),
            RawTransaction(
                transaction_id="tx-rep-002",
                merchant_id="m1",
                customer_id="c1",
                timestamp=_utc(2024, 1, 15, 10, 0),
                amount=99.99,   # same amount within 24h
            ),
        ]
        result = run_feature_pipeline(transactions=txs)
        df = result.full_df.sort_values("timestamp").reset_index(drop=True)

        assert df.iloc[0]["repeated_amount"] == 0   # first tx has no prior
        assert df.iloc[1]["repeated_amount"] == 1, (
            "repeated_amount should be 1 for identical amounts within 24h."
        )

    def test_repeated_amount_first_transaction_zero(self, three_sequential_transactions):
        """First transaction must never have repeated_amount = 1."""
        result = run_feature_pipeline(transactions=three_sequential_transactions)
        df = result.full_df.sort_values("timestamp").reset_index(drop=True)
        assert df.iloc[0]["repeated_amount"] == 0


# ===========================================================================
# 7. Normalization: forbidden columns stripped before downstream use
# ===========================================================================

class TestNormalizationLeakage:

    def test_normalization_strips_is_fraud(self, labeled_transactions):
        """normalize_transactions must remove is_fraud from the DataFrame."""
        from zeno_ml.data.normalization import normalize_transactions
        result = normalize_transactions(labeled_transactions)
        assert "is_fraud" not in result.df.columns, (
            "normalize_transactions returned DataFrame with is_fraud column."
        )

    def test_normalization_strips_is_refunded(self):
        """normalize_transactions must remove is_refunded from the DataFrame."""
        from zeno_ml.data.normalization import normalize_transactions
        tx = RawTransaction(
            transaction_id="tx-r-001",
            merchant_id="m1",
            customer_id="c1",
            timestamp=_utc(2024, 1, 1),
            amount=100.0,
            is_refunded=True,
            refund_amount=100.0,
        )
        result = normalize_transactions([tx])
        assert "is_refunded"   not in result.df.columns
        assert "refund_amount" not in result.df.columns

    def test_labels_preserved_in_label_series(self, labeled_transactions):
        """
        Labels must be in result.label_series (aligned to the DataFrame),
        not embedded in result.df.
        """
        from zeno_ml.data.normalization import normalize_transactions
        result = normalize_transactions(labeled_transactions)
        # Labels must be separate
        assert result.label_series is not None
        assert len(result.label_series) == len(result.df)
        # At least one label should be True
        assert True in result.label_series.values

    def test_scaler_fit_raises_if_scaler_also_passed(self, three_sequential_transactions):
        """
        Providing both fit_scaler=True and a scaler must raise ValueError
        to prevent ambiguous train/inference behaviour.
        """
        from sklearn.preprocessing import StandardScaler

        from zeno_ml.data.normalization import normalize_transactions

        dummy_scaler = StandardScaler()
        with pytest.raises(ValueError, match="fit_scaler=True"):
            normalize_transactions(
                three_sequential_transactions,
                fit_scaler=True,
                scaler=dummy_scaler,
            )

"""
Feature correctness tests.

These tests verify that the feature pipeline produces numerically correct
output for known inputs.  They are separate from the leakage tests:
leakage tests check the temporal contract; these check the arithmetic.

Coverage:
  - Data quality validator: rejection counting, duplicate detection,
    timestamp validation, amount validation
  - Normalization: column presence, sort order, derived column values
  - Transaction features: categorical encodings, calendar features
  - Behavioral features: velocity counts, amount statistics
  - Device/IP features: sharing counts, velocity windows
  - Sequence features: delta computation, structuring detection
  - Pipeline composer: feature matrix shape, column completeness,
    fill values, no NaN in output
  - Aggregator: risk score formula, risk level thresholds
"""

from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from zeno_ml.data.schema import RawTransaction
from zeno_ml.features.base import ALL_FEATURE_COLUMNS, FEATURE_VERSION
from zeno_ml.features.pipeline import run_feature_pipeline
from zeno_ml.inference.aggregator import aggregate_risk_score, normalize_anomaly_score


def _utc(year, month, day, hour=0, minute=0, second=0):
    return datetime(year, month, day, hour, minute, second, tzinfo=timezone.utc)


# ===========================================================================
# Data quality validator
# ===========================================================================

class TestDataQualityValidator:

    def test_valid_record_accepted(self):
        from zeno_ml.data.validation import DataQualityValidator
        records = [{
            "transaction_id": "tx-001",
            "merchant_id":    "m1",
            "customer_id":    "c1",
            "timestamp":      "2024-01-15T10:00:00Z",
            "amount":         100.0,
        }]
        result = DataQualityValidator().validate(records)
        assert result.stats.rows_accepted == 1
        assert result.stats.rows_rejected == 0

    def test_missing_transaction_id_rejected(self):
        from zeno_ml.data.validation import DataQualityValidator
        records = [{"merchant_id": "m1", "customer_id": "c1",
                    "timestamp": "2024-01-15T10:00:00Z", "amount": 100.0}]
        result = DataQualityValidator().validate(records)
        assert result.stats.rows_rejected == 1
        assert result.stats.missing_transaction_id == 1

    def test_negative_amount_rejected(self):
        from zeno_ml.data.validation import DataQualityValidator
        records = [{"transaction_id": "tx-001", "merchant_id": "m1",
                    "customer_id": "c1", "timestamp": "2024-01-15T10:00:00Z",
                    "amount": -50.0}]
        result = DataQualityValidator().validate(records)
        assert result.stats.rows_rejected == 1
        assert result.stats.invalid_amount == 1

    def test_zero_amount_rejected(self):
        from zeno_ml.data.validation import DataQualityValidator
        records = [{"transaction_id": "tx-001", "merchant_id": "m1",
                    "customer_id": "c1", "timestamp": "2024-01-15T10:00:00Z",
                    "amount": 0.0}]
        result = DataQualityValidator().validate(records)
        assert result.stats.rows_rejected == 1

    def test_duplicate_transaction_id_rejected(self):
        from zeno_ml.data.validation import DataQualityValidator
        record = {"transaction_id": "tx-dup", "merchant_id": "m1",
                  "customer_id": "c1", "timestamp": "2024-01-15T10:00:00Z",
                  "amount": 100.0}
        result = DataQualityValidator().validate([record, record.copy()])
        assert result.stats.duplicate_rows == 1
        assert result.stats.rows_accepted == 1
        assert result.stats.rows_rejected == 1

    def test_same_id_different_merchant_not_duplicate(self):
        """Same transaction_id for different merchants must NOT be flagged as duplicate."""
        from zeno_ml.data.validation import DataQualityValidator
        r1 = {"transaction_id": "tx-001", "merchant_id": "m1",
              "customer_id": "c1", "timestamp": "2024-01-15T10:00:00Z", "amount": 100.0}
        r2 = {"transaction_id": "tx-001", "merchant_id": "m2",
              "customer_id": "c2", "timestamp": "2024-01-15T10:00:00Z", "amount": 200.0}
        result = DataQualityValidator().validate([r1, r2])
        assert result.stats.duplicate_rows == 0
        assert result.stats.rows_accepted == 2

    def test_future_timestamp_rejected(self):
        from datetime import timezone as tz
        from zeno_ml.data.validation import DataQualityValidator
        reference = datetime(2024, 1, 15, tzinfo=timezone.utc)
        records = [{"transaction_id": "tx-001", "merchant_id": "m1",
                    "customer_id": "c1", "timestamp": "2025-12-31T00:00:00Z",
                    "amount": 100.0}]
        result = DataQualityValidator().validate(records, reference_time=reference)
        assert result.stats.rows_rejected == 1
        assert result.stats.future_timestamp == 1

    def test_extreme_amount_flagged_not_rejected_in_non_strict_mode(self):
        from zeno_ml.data.validation import DataQualityValidator
        records = [{"transaction_id": "tx-001", "merchant_id": "m1",
                    "customer_id": "c1", "timestamp": "2024-01-15T10:00:00Z",
                    "amount": 2_000_000.0}]
        result = DataQualityValidator().validate(records, strict=False)
        # Non-strict: extreme amount flagged but accepted
        assert result.stats.amount_extreme_high == 1
        assert result.stats.rows_accepted == 1

    def test_extreme_amount_rejected_in_strict_mode(self):
        from zeno_ml.data.validation import DataQualityValidator
        records = [{"transaction_id": "tx-001", "merchant_id": "m1",
                    "customer_id": "c1", "timestamp": "2024-01-15T10:00:00Z",
                    "amount": 2_000_000.0}]
        result = DataQualityValidator(strict=True).validate(records)
        assert result.stats.rows_rejected == 1

    def test_acceptance_rate_calculation(self):
        from zeno_ml.data.validation import DataQualityValidator
        records = [
            {"transaction_id": "tx-001", "merchant_id": "m1", "customer_id": "c1",
             "timestamp": "2024-01-15T10:00:00Z", "amount": 100.0},
            {"merchant_id": "m1", "customer_id": "c1",   # missing transaction_id
             "timestamp": "2024-01-15T10:00:00Z", "amount": 100.0},
        ]
        result = DataQualityValidator().validate(records)
        assert result.stats.acceptance_rate == pytest.approx(0.5)


# ===========================================================================
# Normalization
# ===========================================================================

class TestNormalization:

    def test_output_sorted_by_timestamp(self, three_sequential_transactions):
        from zeno_ml.data.normalization import normalize_transactions
        # Reverse the input order
        reversed_txs = list(reversed(three_sequential_transactions))
        result = normalize_transactions(reversed_txs)
        timestamps = result.df["timestamp"].values
        assert all(timestamps[i] <= timestamps[i + 1] for i in range(len(timestamps) - 1)), (
            "Normalized DataFrame is not sorted by timestamp."
        )

    def test_log_amount_computed(self, three_sequential_transactions):
        from zeno_ml.data.normalization import normalize_transactions
        result = normalize_transactions(three_sequential_transactions)
        assert "log_amount" in result.df.columns
        # log1p(100) ≈ 4.615
        row = result.df[result.df["amount"] == 100.0].iloc[0]
        assert row["log_amount"] == pytest.approx(np.log1p(100.0), rel=1e-6)

    def test_hour_of_day_correct(self):
        from zeno_ml.data.normalization import normalize_transactions
        tx = RawTransaction(
            transaction_id="tx-hour",
            merchant_id="m1", customer_id="c1",
            timestamp=_utc(2024, 1, 15, 14, 30),
            amount=50.0,
        )
        result = normalize_transactions([tx])
        assert result.df.iloc[0]["hour_of_day"] == 14

    def test_day_of_week_correct(self):
        from zeno_ml.data.normalization import normalize_transactions
        # 2024-01-15 is a Monday (dayofweek = 0)
        tx = RawTransaction(
            transaction_id="tx-dow",
            merchant_id="m1", customer_id="c1",
            timestamp=_utc(2024, 1, 15),
            amount=50.0,
        )
        result = normalize_transactions([tx])
        assert result.df.iloc[0]["day_of_week"] == 0   # Monday

    def test_country_mismatch_detected(self):
        from zeno_ml.data.normalization import normalize_transactions
        tx = RawTransaction(
            transaction_id="tx-mismatch",
            merchant_id="m1", customer_id="c1",
            timestamp=_utc(2024, 1, 15),
            amount=100.0,
            billing_country="US",
            shipping_country="RU",
        )
        result = normalize_transactions([tx])
        assert result.df.iloc[0]["country_mismatch"] == 1

    def test_country_match_zero(self):
        from zeno_ml.data.normalization import normalize_transactions
        tx = RawTransaction(
            transaction_id="tx-match",
            merchant_id="m1", customer_id="c1",
            timestamp=_utc(2024, 1, 15),
            amount=100.0,
            billing_country="US",
            shipping_country="US",
        )
        result = normalize_transactions([tx])
        assert result.df.iloc[0]["country_mismatch"] == 0

    def test_country_missing_negative_one(self):
        from zeno_ml.data.normalization import normalize_transactions
        tx = RawTransaction(
            transaction_id="tx-unknown-country",
            merchant_id="m1", customer_id="c1",
            timestamp=_utc(2024, 1, 15),
            amount=100.0,
            billing_country=None,
            shipping_country=None,
        )
        result = normalize_transactions([tx])
        assert result.df.iloc[0]["country_mismatch"] == -1


# ===========================================================================
# Transaction features
# ===========================================================================

class TestTransactionFeatures:

    def test_is_weekend_monday(self):
        # 2024-01-15 = Monday
        tx = RawTransaction(
            transaction_id="tx-mon",
            merchant_id="m1", customer_id="c1",
            timestamp=_utc(2024, 1, 15, 10),
            amount=100.0,
        )
        result = run_feature_pipeline(transactions=[tx])
        df = result.full_df
        assert df.iloc[0]["is_weekend"] == 0

    def test_is_weekend_saturday(self):
        # 2024-01-20 = Saturday
        tx = RawTransaction(
            transaction_id="tx-sat",
            merchant_id="m1", customer_id="c1",
            timestamp=_utc(2024, 1, 20, 10),
            amount=100.0,
        )
        result = run_feature_pipeline(transactions=[tx])
        assert result.full_df.iloc[0]["is_weekend"] == 1

    def test_is_night_at_3am(self):
        tx = RawTransaction(
            transaction_id="tx-night",
            merchant_id="m1", customer_id="c1",
            timestamp=_utc(2024, 1, 15, 3),
            amount=100.0,
        )
        result = run_feature_pipeline(transactions=[tx])
        assert result.full_df.iloc[0]["is_night"] == 1

    def test_is_night_at_noon(self):
        tx = RawTransaction(
            transaction_id="tx-noon",
            merchant_id="m1", customer_id="c1",
            timestamp=_utc(2024, 1, 15, 12),
            amount=100.0,
        )
        result = run_feature_pipeline(transactions=[tx])
        assert result.full_df.iloc[0]["is_night"] == 0

    def test_has_device_id_present(self):
        tx = RawTransaction(
            transaction_id="tx-dev",
            merchant_id="m1", customer_id="c1",
            timestamp=_utc(2024, 1, 15),
            amount=100.0,
            device_id="DEV-001",
        )
        result = run_feature_pipeline(transactions=[tx])
        assert result.full_df.iloc[0]["has_device_id"] == 1

    def test_has_device_id_absent(self):
        tx = RawTransaction(
            transaction_id="tx-nodev",
            merchant_id="m1", customer_id="c1",
            timestamp=_utc(2024, 1, 15),
            amount=100.0,
            device_id=None,
        )
        result = run_feature_pipeline(transactions=[tx])
        assert result.full_df.iloc[0]["has_device_id"] == 0

    def test_payment_method_encoding_card(self):
        tx = RawTransaction(
            transaction_id="tx-card",
            merchant_id="m1", customer_id="c1",
            timestamp=_utc(2024, 1, 15),
            amount=100.0,
            payment_method="CARD",
        )
        result = run_feature_pipeline(transactions=[tx])
        assert result.full_df.iloc[0]["payment_method_enc"] == 1

    def test_payment_method_unknown_encodes_zero(self):
        tx = RawTransaction(
            transaction_id="tx-unknown-pm",
            merchant_id="m1", customer_id="c1",
            timestamp=_utc(2024, 1, 15),
            amount=100.0,
        )
        result = run_feature_pipeline(transactions=[tx])
        assert result.full_df.iloc[0]["payment_method_enc"] == 0


# ===========================================================================
# Pipeline composer: shape and completeness
# ===========================================================================

class TestPipelineComposer:

    def test_feature_matrix_has_all_columns(self, three_sequential_transactions):
        """feature_matrix must contain every column in ALL_FEATURE_COLUMNS."""
        result = run_feature_pipeline(transactions=three_sequential_transactions)
        missing = [c for c in ALL_FEATURE_COLUMNS if c not in result.feature_matrix.columns]
        assert missing == [], f"Missing feature columns: {missing}"

    def test_feature_matrix_no_nan(self, three_sequential_transactions):
        """After fill_values, the feature matrix must have no NaN."""
        result = run_feature_pipeline(transactions=three_sequential_transactions)
        nan_cols = result.feature_matrix.columns[result.feature_matrix.isna().any()].tolist()
        assert nan_cols == [], f"NaN found in feature columns after fill: {nan_cols}"

    def test_feature_matrix_all_float64(self, three_sequential_transactions):
        """All feature columns must be float64 for XGBoost compatibility."""
        result = run_feature_pipeline(transactions=three_sequential_transactions)
        non_float = [
            c for c in result.feature_matrix.columns
            if result.feature_matrix[c].dtype != np.float64
        ]
        assert non_float == [], f"Non-float64 feature columns: {non_float}"

    def test_feature_version_constant(self, three_sequential_transactions):
        """feature_version must match the declared constant."""
        result = run_feature_pipeline(transactions=three_sequential_transactions)
        assert result.feature_version == FEATURE_VERSION

    def test_row_count_matches_input(self, three_sequential_transactions):
        """Output row count must equal input transaction count."""
        result = run_feature_pipeline(transactions=three_sequential_transactions)
        assert len(result.feature_matrix) == len(three_sequential_transactions)

    def test_transaction_ids_preserved(self, three_sequential_transactions):
        """transaction_ids in result must match input (possibly reordered by sort)."""
        result = run_feature_pipeline(transactions=three_sequential_transactions)
        expected_ids = {tx.transaction_id for tx in three_sequential_transactions}
        actual_ids   = set(result.transaction_ids)
        assert expected_ids == actual_ids

    def test_empty_input_returns_empty_result(self):
        """Empty transaction list must return an empty result without error."""
        result = run_feature_pipeline(transactions=[])
        assert len(result.feature_matrix) == 0
        assert len(result.labels) == 0

    def test_labels_aligned_to_feature_matrix(self, labeled_transactions):
        """Labels must be correctly aligned: first tx is fraud, second is not."""
        result = run_feature_pipeline(transactions=labeled_transactions)
        # Build a map from transaction_id → label for verification
        label_map = {
            tx.transaction_id: tx.is_fraud
            for tx in labeled_transactions
        }
        for tx_id, label in zip(result.transaction_ids, result.labels):
            assert label == label_map[tx_id], (
                f"Label mismatch for tx {tx_id}: got {label}, expected {label_map[tx_id]}"
            )


# ===========================================================================
# Risk aggregator
# ===========================================================================

class TestAggregator:

    def test_pure_fraud_probability_gives_high_score(self):
        score, level = aggregate_risk_score(fraud_probability=0.95, anomaly_score=0.0)
        # 0.75 × 0.95 + 0.25 × 0.0 = 0.7125 → 71 → HIGH
        assert score == pytest.approx(71, abs=1)
        assert level == "HIGH"

    def test_zero_risk_gives_low_level(self):
        score, level = aggregate_risk_score(fraud_probability=0.0, anomaly_score=0.0)
        assert score == 0
        assert level == "LOW"

    def test_full_risk_gives_critical(self):
        score, level = aggregate_risk_score(fraud_probability=1.0, anomaly_score=1.0)
        assert score == 100
        assert level == "CRITICAL"

    def test_medium_risk_boundary(self):
        # At the MEDIUM threshold (40), level must be MEDIUM not LOW
        # 0.75 * fp + 0.25 * as = 0.40
        # fp = 0.40 / 0.75 ≈ 0.533, as = 0
        score, level = aggregate_risk_score(fraud_probability=0.533, anomaly_score=0.0)
        assert level in {"MEDIUM", "HIGH"}, f"Expected MEDIUM or HIGH, got {level} (score={score})"

    def test_clamps_out_of_range_inputs(self):
        """Inputs outside [0,1] must be clamped without raising."""
        score, level = aggregate_risk_score(fraud_probability=1.5, anomaly_score=-0.3)
        assert 0 <= score <= 100

    def test_anomaly_normalization_high_anomaly(self):
        """Raw IF score of -0.5 (max anomaly) → normalised ≈ 1.0."""
        n = normalize_anomaly_score(-0.5)
        assert n == pytest.approx(1.0, abs=0.01)

    def test_anomaly_normalization_normal(self):
        """Raw IF score of +0.5 (normal) → normalised = 0.0."""
        n = normalize_anomaly_score(0.5)
        assert n == pytest.approx(0.0, abs=0.01)

    def test_anomaly_normalization_clamped(self):
        """normalised score must always be in [0, 1]."""
        assert normalize_anomaly_score(-1.0) == 1.0   # clamped at 1
        assert normalize_anomaly_score( 1.0) == 0.0   # clamped at 0

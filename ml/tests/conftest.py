"""
Shared pytest fixtures for the Niro ML test suite.

Every fixture that builds transactions uses explicit, controlled timestamps
so that temporal leakage tests are deterministic.
"""

from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path

import pytest

# Make the src package importable without installation
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from niro_ml.data.schema import CustomerContext, RawTransaction


def _utc(year: int, month: int, day: int, hour: int = 0, minute: int = 0) -> datetime:
    return datetime(year, month, day, hour, minute, tzinfo=timezone.utc)


# ---------------------------------------------------------------------------
# Single-merchant fixture with controlled timestamps
# ---------------------------------------------------------------------------

@pytest.fixture
def merchant_id() -> str:
    return "merchant-test-001"


@pytest.fixture
def customer_a() -> str:
    return "customer-A"


@pytest.fixture
def customer_b() -> str:
    return "customer-B"


@pytest.fixture
def three_sequential_transactions(merchant_id, customer_a) -> list[RawTransaction]:
    """
    Three transactions for the same customer, 1 hour apart.
    T0 = 09:00, T1 = 10:00, T2 = 11:00 on 2024-01-15.
    """
    base = {"merchant_id": merchant_id, "customer_id": customer_a}
    return [
        RawTransaction(
            transaction_id="tx-001",
            timestamp=_utc(2024, 1, 15, 9, 0),
            amount=100.0,
            **base,
        ),
        RawTransaction(
            transaction_id="tx-002",
            timestamp=_utc(2024, 1, 15, 10, 0),
            amount=200.0,
            **base,
        ),
        RawTransaction(
            transaction_id="tx-003",
            timestamp=_utc(2024, 1, 15, 11, 0),
            amount=300.0,
            **base,
        ),
    ]


@pytest.fixture
def velocity_burst_transactions(merchant_id, customer_a) -> list[RawTransaction]:
    """
    6 transactions for the same customer in a 10-minute window
    (designed to trigger velocity features).
    """
    base = {"merchant_id": merchant_id, "customer_id": customer_a}
    return [
        RawTransaction(
            transaction_id=f"tx-burst-{i:03d}",
            timestamp=_utc(2024, 1, 15, 12, i),   # 12:00, 12:01, ..., 12:05
            amount=50.0 + i * 10,
            **base,
        )
        for i in range(6)
    ]


@pytest.fixture
def two_customer_transactions(merchant_id, customer_a, customer_b) -> list[RawTransaction]:
    """
    Transactions from two different customers sharing a device and IP.
    Used for device/IP leakage and isolation tests.
    """
    shared_device = "DEV-SHARED-001"
    shared_ip     = "192.168.1.100"
    return [
        # Customer A transacts first
        RawTransaction(
            transaction_id="tx-A-001",
            merchant_id=merchant_id,
            customer_id=customer_a,
            timestamp=_utc(2024, 1, 15, 8, 0),
            amount=150.0,
            device_id=shared_device,
            ip_address=shared_ip,
        ),
        RawTransaction(
            transaction_id="tx-A-002",
            merchant_id=merchant_id,
            customer_id=customer_a,
            timestamp=_utc(2024, 1, 15, 9, 0),
            amount=200.0,
            device_id=shared_device,
            ip_address=shared_ip,
        ),
        # Customer B transacts AFTER customer A — should see customers_per_device=2
        RawTransaction(
            transaction_id="tx-B-001",
            merchant_id=merchant_id,
            customer_id=customer_b,
            timestamp=_utc(2024, 1, 15, 10, 0),
            amount=180.0,
            device_id=shared_device,
            ip_address=shared_ip,
        ),
    ]


@pytest.fixture
def two_merchant_transactions() -> list[RawTransaction]:
    """
    Same device used across two different merchants.
    Features must NOT bleed across merchant boundaries.
    """
    shared_device = "DEV-SHARED-XM"
    return [
        RawTransaction(
            transaction_id="tx-M1-001",
            merchant_id="merchant-X",
            customer_id="customer-X",
            timestamp=_utc(2024, 1, 15, 8, 0),
            amount=100.0,
            device_id=shared_device,
        ),
        RawTransaction(
            transaction_id="tx-M2-001",
            merchant_id="merchant-Y",
            customer_id="customer-Y",
            timestamp=_utc(2024, 1, 15, 9, 0),
            amount=100.0,
            device_id=shared_device,
        ),
    ]


@pytest.fixture
def labeled_transactions(merchant_id, customer_a, customer_b) -> list[RawTransaction]:
    """
    Transactions with is_fraud labels — used to verify labels never leak
    into the feature matrix.
    """
    return [
        RawTransaction(
            transaction_id="tx-labeled-001",
            merchant_id=merchant_id,
            customer_id=customer_a,
            timestamp=_utc(2024, 1, 15, 9, 0),
            amount=500.0,
            is_fraud=True,
        ),
        RawTransaction(
            transaction_id="tx-labeled-002",
            merchant_id=merchant_id,
            customer_id=customer_b,
            timestamp=_utc(2024, 1, 15, 10, 0),
            amount=75.0,
            is_fraud=False,
        ),
    ]


@pytest.fixture
def customer_context_a(merchant_id, customer_a) -> CustomerContext:
    return CustomerContext(
        customer_id=customer_a,
        merchant_id=merchant_id,
        account_age_days=365,
        historical_transaction_count=20,
        historical_total_amount=4000.0,
        historical_refund_count=2,
        historical_device_count=2,
        historical_ip_count=3,
        historical_fraud_rate=0.0,
    )

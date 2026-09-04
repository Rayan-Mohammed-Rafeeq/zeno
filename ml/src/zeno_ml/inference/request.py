"""
Pydantic request models for the FastAPI ML inference endpoints.

Spring Boot sends these payloads; the ML service validates them before
any feature computation begins.  Validation errors return HTTP 422 with
a structured error body — never a silent default prediction.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class TransactionPayload(BaseModel):
    """
    Minimal transaction payload for a single-transaction prediction request.

    Mirrors the RawTransaction canonical schema but uses only the fields
    that Spring Boot can reliably supply at scoring time.
    Fields not available in real-time (e.g. is_refunded, is_fraud) are
    intentionally absent.
    """
    transaction_id:    str
    merchant_id:       str
    customer_id:       str
    timestamp:         datetime
    amount:            float = Field(gt=0)
    currency:          str   = Field(default="USD", min_length=3, max_length=3)
    payment_method:    str   = Field(default="UNKNOWN")
    device_id:         Optional[str] = None
    ip_address:        Optional[str] = None
    billing_country:   Optional[str] = Field(default=None, max_length=2)
    shipping_country:  Optional[str] = Field(default=None, max_length=2)
    merchant_category: str   = Field(default="UNKNOWN")
    email_domain:      Optional[str] = None

    @field_validator("currency")
    @classmethod
    def currency_upper(cls, v: str) -> str:
        return v.upper().strip()


class CustomerContextPayload(BaseModel):
    """
    Historical customer context supplied by Spring Boot alongside the transaction.

    Spring Boot computes these aggregates from its own database, using
    only transactions strictly before the prediction timestamp.
    """
    account_age_days:               Optional[int]   = Field(default=None, ge=0)
    historical_transaction_count:   int             = Field(default=0, ge=0)
    historical_total_amount:        float           = Field(default=0.0, ge=0)
    historical_refund_count:        int             = Field(default=0, ge=0)
    historical_device_count:        int             = Field(default=0, ge=0)
    historical_ip_count:            int             = Field(default=0, ge=0)
    historical_fraud_rate:          Optional[float] = Field(default=None, ge=0, le=1)


class PredictRequest(BaseModel):
    """
    Full prediction request payload.
    Spring Boot populates both sections before calling POST /ml/predict.
    """
    transaction:       TransactionPayload
    customer_context:  CustomerContextPayload = Field(default_factory=CustomerContextPayload)


class BatchPredictRequest(BaseModel):
    """
    Batch prediction request — used for bulk risk scanning.
    Each item is a full PredictRequest.
    Maximum 1 000 items per batch to keep inference time bounded.
    """
    requests: list[PredictRequest] = Field(min_length=1, max_length=1_000)

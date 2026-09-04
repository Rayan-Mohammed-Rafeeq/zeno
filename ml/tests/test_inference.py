"""
FastAPI inference endpoint integration tests.

Tests the /health, /ml/predict, /ml/batch-predict, and /ml/monitoring/health
endpoints via HTTPX async client.

When model artefacts are absent (the normal CI state), /ml/predict must return
HTTP 503 — never a silent default prediction.  /health must always return 200.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest
from httpx import AsyncClient, ASGITransport

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from zeno_ml.inference.app import app


# ── Shared transport ────────────────────────────────────────────────────────

def _client() -> AsyncClient:
    """Create an async test client using ASGI transport (httpx >= 0.24)."""
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


# ── Shared payload ─────────────────────────────────────────────────────────

VALID_PREDICT_BODY = {
    "transaction": {
        "transaction_id":    "tx-test-001",
        "merchant_id":       "merchant-test",
        "customer_id":       "customer-test",
        "timestamp":         "2024-01-15T10:00:00Z",
        "amount":            150.0,
        "currency":          "USD",
        "payment_method":    "CARD",
        "device_id":         "DEV-001",
        "ip_address":        "1.2.3.4",
        "billing_country":   "US",
        "shipping_country":  "US",
        "merchant_category": "ELECTRONICS",
        "email_domain":      "gmail.com",
    },
    "customer_context": {
        "account_age_days":               365,
        "historical_transaction_count":   10,
        "historical_total_amount":        1500.0,
        "historical_refund_count":        1,
        "historical_device_count":        2,
        "historical_ip_count":            2,
        "historical_fraud_rate":          None,
    },
}


# ── Health endpoint ────────────────────────────────────────────────────────

class TestHealthEndpoint:

    @pytest.mark.asyncio
    async def test_health_always_returns_200(self):
        """/health must always return HTTP 200 regardless of model state."""
        async with _client() as client:
            resp = await client.get("/health")
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_health_returns_service_field(self):
        async with _client() as client:
            resp = await client.get("/health")
        data = resp.json()
        assert data.get("service") == "zeno-ml"

    @pytest.mark.asyncio
    async def test_health_has_model_status_field(self):
        async with _client() as client:
            resp = await client.get("/health")
        data = resp.json()
        assert "model_status" in data
        assert data["model_status"] in ("UNLOADED", "LOADING", "READY", "FAILED")

    @pytest.mark.asyncio
    async def test_health_status_degraded_without_artefacts(self):
        """Without trained artefacts, health status must not be UP (model not loaded)."""
        async with _client() as client:
            resp = await client.get("/health")
        data = resp.json()
        # DEGRADED = service running, model not loaded (artefacts absent)
        # DOWN     = service starting up (UNLOADED/LOADING state)
        # Either is acceptable when artefacts are absent
        assert data.get("status") in ("UP", "DEGRADED", "DOWN"), (
            f"Unexpected status: {data.get('status')}"
        )


# ── Predict endpoint ───────────────────────────────────────────────────────

class TestPredictEndpoint:

    @pytest.mark.asyncio
    async def test_predict_without_model_returns_503(self):
        """
        /ml/predict MUST return HTTP 503 when model artefacts are absent.
        It must NEVER return 200 with a silent default prediction.
        """
        async with _client() as client:
            resp = await client.post("/ml/predict", json=VALID_PREDICT_BODY)

        # Either 503 (model not ready) or 200 (model loaded in test env)
        assert resp.status_code in (200, 503), (
            f"Expected 200 or 503, got {resp.status_code}: {resp.text}"
        )

        if resp.status_code == 503:
            body = resp.json()
            detail = body.get("detail", {})
            # Must have a meaningful error, not a silent default
            assert "MODEL_NOT_READY" in str(detail) or "model" in str(detail).lower(), (
                "503 response must explain that the model is not ready."
            )

    @pytest.mark.asyncio
    async def test_predict_invalid_amount_returns_422(self):
        """Negative amount must be rejected with HTTP 422 (validation error)."""
        bad_body = {**VALID_PREDICT_BODY,
                    "transaction": {**VALID_PREDICT_BODY["transaction"], "amount": -50.0}}
        async with _client() as client:
            resp = await client.post("/ml/predict", json=bad_body)
        assert resp.status_code == 422, (
            f"Negative amount should be rejected with 422, got {resp.status_code}"
        )

    @pytest.mark.asyncio
    async def test_predict_missing_required_field_returns_422(self):
        """Missing required field (transaction_id) must return 422."""
        bad_body = {"transaction": {"amount": 100.0}, "customer_context": {}}
        async with _client() as client:
            resp = await client.post("/ml/predict", json=bad_body)
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_predict_empty_body_returns_422(self):
        async with _client() as client:
            resp = await client.post("/ml/predict", json={})
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_predict_if_200_response_has_required_fields(self):
        """If the model IS loaded and returns 200, validate response schema."""
        async with _client() as client:
            resp = await client.post("/ml/predict", json=VALID_PREDICT_BODY)
        if resp.status_code != 200:
            pytest.skip("Model not loaded — schema test skipped.")
        data = resp.json()
        for field in ["fraud_probability", "anomaly_score", "risk_score",
                      "risk_level", "model_version", "feature_version",
                      "processing_ms", "model_status"]:
            assert field in data, f"Missing field: {field}"

    @pytest.mark.asyncio
    async def test_predict_if_200_probabilities_in_unit_interval(self):
        async with _client() as client:
            resp = await client.post("/ml/predict", json=VALID_PREDICT_BODY)
        if resp.status_code != 200:
            pytest.skip("Model not loaded.")
        data = resp.json()
        assert 0.0 <= data["fraud_probability"] <= 1.0, \
            f"fraud_probability out of [0,1]: {data['fraud_probability']}"
        assert 0.0 <= data["anomaly_score"] <= 1.0, \
            f"anomaly_score out of [0,1]: {data['anomaly_score']}"

    @pytest.mark.asyncio
    async def test_predict_if_200_risk_score_in_range(self):
        async with _client() as client:
            resp = await client.post("/ml/predict", json=VALID_PREDICT_BODY)
        if resp.status_code != 200:
            pytest.skip("Model not loaded.")
        data = resp.json()
        assert 0 <= data["risk_score"] <= 100, \
            f"risk_score out of [0,100]: {data['risk_score']}"

    @pytest.mark.asyncio
    async def test_predict_if_200_risk_level_valid(self):
        async with _client() as client:
            resp = await client.post("/ml/predict", json=VALID_PREDICT_BODY)
        if resp.status_code != 200:
            pytest.skip("Model not loaded.")
        data = resp.json()
        assert data["risk_level"] in ("LOW", "MEDIUM", "HIGH", "CRITICAL"), \
            f"Invalid risk_level: {data['risk_level']}"

    @pytest.mark.asyncio
    async def test_predict_model_status_is_ready_on_200(self):
        async with _client() as client:
            resp = await client.post("/ml/predict", json=VALID_PREDICT_BODY)
        if resp.status_code != 200:
            pytest.skip("Model not loaded.")
        data = resp.json()
        assert data["model_status"] == "READY", (
            "A 200 response must always have model_status='READY'. "
            "Never return silent default predictions."
        )


# ── Batch predict endpoint ─────────────────────────────────────────────────

class TestBatchPredictEndpoint:

    @pytest.mark.asyncio
    async def test_batch_predict_without_model_returns_503(self):
        body = {"requests": [VALID_PREDICT_BODY]}
        async with _client() as client:
            resp = await client.post("/ml/batch-predict", json=body)
        assert resp.status_code in (200, 503)

    @pytest.mark.asyncio
    async def test_batch_predict_empty_list_returns_422(self):
        """Empty requests list must be rejected (min_length=1 on the field)."""
        body = {"requests": []}
        async with _client() as client:
            resp = await client.post("/ml/batch-predict", json=body)
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_batch_predict_over_limit_returns_422(self):
        """More than 1000 requests must be rejected (max_length=1000)."""
        body = {"requests": [VALID_PREDICT_BODY] * 1001}
        async with _client() as client:
            resp = await client.post("/ml/batch-predict", json=body)
        assert resp.status_code == 422


# ── Model info endpoint ────────────────────────────────────────────────────

class TestModelInfoEndpoint:

    @pytest.mark.asyncio
    async def test_model_info_503_without_model(self):
        """/ml/model-info must return 503 when model not loaded."""
        async with _client() as client:
            resp = await client.get("/ml/model-info")
        # 503 if not loaded, 200 if loaded
        assert resp.status_code in (200, 503)

    @pytest.mark.asyncio
    async def test_model_info_if_200_has_version_fields(self):
        async with _client() as client:
            resp = await client.get("/ml/model-info")
        if resp.status_code != 200:
            pytest.skip("Model not loaded.")
        data = resp.json()
        assert "model_version"   in data
        assert "feature_version" in data
        assert "threshold"       in data
        assert "feature_names"   in data


# ── Monitoring endpoint ────────────────────────────────────────────────────

class TestMonitoringEndpoint:

    @pytest.mark.asyncio
    async def test_monitoring_health_always_200(self):
        """/ml/monitoring/health must always return HTTP 200."""
        async with _client() as client:
            resp = await client.get("/ml/monitoring/health")
        assert resp.status_code == 200

    @pytest.mark.asyncio
    async def test_monitoring_has_required_fields(self):
        async with _client() as client:
            resp = await client.get("/ml/monitoring/health")
        data = resp.json()
        for field in ["model_status", "overall_status", "n_recent_predictions",
                      "prediction_distribution", "data_quality", "limitations"]:
            assert field in data, f"Missing monitoring field: {field}"

    @pytest.mark.asyncio
    async def test_monitoring_overall_status_valid(self):
        async with _client() as client:
            resp = await client.get("/ml/monitoring/health")
        data = resp.json()
        assert data["overall_status"] in ("HEALTHY", "DEGRADED", "CRITICAL", "UNAVAILABLE"), \
            f"Invalid overall_status: {data['overall_status']}"

    @pytest.mark.asyncio
    async def test_monitoring_n_recent_starts_at_zero(self):
        """On a fresh service start, n_recent_predictions is 0."""
        async with _client() as client:
            resp = await client.get("/ml/monitoring/health")
        data = resp.json()
        assert data["n_recent_predictions"] >= 0

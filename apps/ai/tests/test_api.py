"""tests/test_api.py — FastAPI endpoint tests."""
from __future__ import annotations

import json
import os

os.environ["LLM_PROVIDER"] = "mock"
os.environ["ENVIRONMENT"] = "development"
os.environ["AI_SERVICE_API_KEY"] = ""

import pytest
from fastapi.testclient import TestClient

from workflows.refill_resolution.schemas import RefillAnalysisRequest


def test_health_endpoint(test_client: TestClient) -> None:
    response = test_client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "zeno-ai"


def test_analyze_endpoint_returns_recommendation(
    test_client: TestClient,
    no_refills_request: RefillAnalysisRequest,
) -> None:
    response = test_client.post(
        "/api/ai/refill-resolution/analyze",
        json=no_refills_request.model_dump(mode="json"),
        headers={"X-Request-ID": "test-req-001"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["refill_id"] == 1001
    assert body["case_id"] == 201
    assert "blocker" in body
    assert "recommended_action" in body
    assert "requires_human_approval" in body
    assert "safety_class" in body
    assert "model_metadata" in body


def test_analyze_endpoint_with_expired_prescription(
    test_client: TestClient,
    expired_prescription_request: RefillAnalysisRequest,
) -> None:
    response = test_client.post(
        "/api/ai/refill-resolution/analyze",
        json=expired_prescription_request.model_dump(mode="json"),
    )
    assert response.status_code == 200
    body = response.json()
    assert body["blocker"] == "NEW_PRESCRIPTION_REQUIRED"


def test_analyze_rejects_malformed_input(test_client: TestClient) -> None:
    response = test_client.post(
        "/api/ai/refill-resolution/analyze",
        json={"garbage": "data"},
    )
    assert response.status_code == 422


def test_request_id_header_returned(
    test_client: TestClient,
    no_refills_request: RefillAnalysisRequest,
) -> None:
    response = test_client.post(
        "/api/ai/refill-resolution/analyze",
        json=no_refills_request.model_dump(mode="json"),
        headers={"X-Request-ID": "my-correlation-id"},
    )
    assert response.headers.get("X-Request-ID") == "my-correlation-id"

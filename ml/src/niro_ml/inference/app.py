"""
Niro ML FastAPI inference service.

Endpoints:
  GET  /health              — service + model health (always returns 200)
  GET  /ml/model-info       — loaded model metadata (503 if model not ready)
  POST /ml/predict          — single-transaction fraud prediction
  POST /ml/batch-predict    — batch predictions (≤ 1 000 transactions)

Design principles:
  - Model loaded once at startup via lifespan; never reloaded per request.
  - If model artefacts are absent, /health returns DEGRADED (not 500).
    Prediction endpoints return HTTP 503 with a clear error body.
  - No silent defaults: a failed prediction ALWAYS raises an exception
    that the caller can detect and log.
  - Every response includes model_version and feature_version for auditability.
  - Request validation (Pydantic) happens before any ML code runs.
  - Structured logging on every prediction (transaction_id, latency, score).
"""

from __future__ import annotations

import logging
import time
from contextlib import asynccontextmanager

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse

from niro_ml.data.schema import CustomerContext, RawTransaction
from niro_ml.features.pipeline import audit_for_leakage, run_feature_pipeline
from niro_ml.inference.aggregator import aggregate_risk_score, normalize_anomaly_score
from niro_ml.inference.model_registry import RegistryStatus, get_registry
from niro_ml.inference.request import BatchPredictRequest, PredictRequest
from niro_ml.inference.response import (
    BatchPredictResponse,
    FeatureContribution,
    HealthResponse,
    ModelInfoResponse,
    PredictResponse,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Application lifespan — model loaded once at startup
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load model artefacts once at startup.  Graceful if artefacts absent."""
    registry = get_registry()
    registry.load()
    if registry.is_ready:
        logger.info("Niro ML service started — model READY.")
    else:
        logger.warning(
            "Niro ML service started — model NOT ready. "
            "Prediction endpoints will return 503 until models are trained."
        )
    yield
    logger.info("Niro ML service shutting down.")


# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Niro ML Inference Service",
    description=(
        "Enterprise fraud risk ML service. "
        "Provides XGBoost fraud probability, Isolation Forest anomaly score, "
        "and SHAP feature contributions."
    ),
    version="0.1.0",
    lifespan=lifespan,
)


# ---------------------------------------------------------------------------
# Health endpoint
# ---------------------------------------------------------------------------

@app.get("/health", response_model=HealthResponse, tags=["Infrastructure"])
async def health() -> HealthResponse:
    """
    Service health check.

    Always returns HTTP 200 — status field indicates model readiness.
    Spring Boot should check model_status == 'READY' before relying on
    predictions.  DEGRADED means the service is running but the model
    artefacts are not yet available (e.g. before first training run).
    """
    registry = get_registry()
    h = registry.health_dict()

    if registry.status == RegistryStatus.READY:
        service_status = "UP"
    elif registry.status == RegistryStatus.FAILED:
        service_status = "DEGRADED"
    else:
        service_status = "DOWN"

    return HealthResponse(
        status=service_status,
        model_status=h.get("model_status", "UNLOADED"),
        model_version=h.get("model_version"),
        feature_version=h.get("feature_version"),
        threshold=h.get("threshold"),
        feature_count=h.get("feature_count"),
        load_error=h.get("load_error"),
    )


# ---------------------------------------------------------------------------
# Model info
# ---------------------------------------------------------------------------

@app.get("/ml/model-info", response_model=ModelInfoResponse, tags=["Model"])
async def model_info() -> ModelInfoResponse:
    """Return metadata about the currently loaded model."""
    registry = get_registry()
    _require_model_ready(registry)
    bundle = registry.get_bundle()
    return ModelInfoResponse(
        model_version=bundle.model_version,
        feature_version=bundle.feature_version,
        threshold=bundle.threshold,
        feature_names=bundle.feature_names,
        metadata=bundle.metadata,
    )


# ---------------------------------------------------------------------------
# Single prediction
# ---------------------------------------------------------------------------

@app.post("/ml/predict", response_model=PredictResponse, tags=["Prediction"])
async def predict(request: PredictRequest) -> PredictResponse:
    """
    Predict fraud probability for a single transaction.

    Returns HTTP 503 if the model is not loaded.
    Returns HTTP 422 if the request payload fails validation.
    Never returns a silent default — any internal error propagates as HTTP 500.
    """
    registry = get_registry()
    _require_model_ready(registry)
    bundle = registry.get_bundle()

    t_start = time.monotonic()

    # Convert request to canonical schema
    tx, ctx = _request_to_canonical(request)

    # Run feature pipeline
    pipeline_result = run_feature_pipeline(
        transactions=[tx],
        customer_contexts={tx.customer_id: ctx},
        scaler=bundle.scaler,
    )

    # Leakage audit (fast — just checks column names)
    leakage = audit_for_leakage(pipeline_result.feature_matrix)
    if leakage:
        logger.error(
            "LEAKAGE DETECTED in prediction for tx %s: %s",
            request.transaction.transaction_id,
            leakage,
        )
        # Do not proceed — this is a critical data integrity failure
        raise HTTPException(
            status_code=500,
            detail=f"Feature pipeline leakage detected: {leakage}. Prediction aborted.",
        )

    X = pipeline_result.feature_matrix.values

    # XGBoost prediction
    fraud_probability = _predict_fraud_probability(bundle, X)

    # Isolation Forest anomaly score
    anomaly_score_raw = _predict_anomaly_score(bundle, X)
    anomaly_score = normalize_anomaly_score(anomaly_score_raw)

    # Risk aggregation
    risk_score, risk_level = aggregate_risk_score(fraud_probability, anomaly_score)

    # SHAP explanations (Milestone 5 will add full SHAP TreeExplainer;
    # for now, return empty list — model not yet trained)
    contributions: list[FeatureContribution] = []

    processing_ms = int((time.monotonic() - t_start) * 1000)

    logger.info(
        "Prediction: tx=%s merchant=%s fp=%.4f anomaly=%.4f risk=%d/%s latency=%dms",
        request.transaction.transaction_id,
        request.transaction.merchant_id,
        fraud_probability,
        anomaly_score,
        risk_score,
        risk_level,
        processing_ms,
    )

    return PredictResponse(
        fraud_probability=round(fraud_probability, 6),
        anomaly_score=round(anomaly_score, 6),
        risk_score=risk_score,
        risk_level=risk_level,  # type: ignore[arg-type]
        threshold=bundle.threshold,
        feature_contributions=contributions,
        model_version=bundle.model_version,
        feature_version=bundle.feature_version,
        processing_ms=processing_ms,
        model_status="READY",
    )


# ---------------------------------------------------------------------------
# Batch prediction
# ---------------------------------------------------------------------------

@app.post("/ml/batch-predict", response_model=BatchPredictResponse, tags=["Prediction"])
async def batch_predict(request: BatchPredictRequest) -> BatchPredictResponse:
    """
    Predict fraud probability for a batch of transactions (≤ 1 000).

    Transactions in the batch are processed as a single feature pipeline
    run so that cross-transaction behavioral features (velocity, device
    sharing) are computed correctly.

    NOTE: Temporal ordering within the batch is enforced by the pipeline
    — the sort is applied inside run_feature_pipeline().
    """
    registry = get_registry()
    _require_model_ready(registry)
    bundle = registry.get_bundle()

    t_start = time.monotonic()

    transactions = []
    ctx_map: dict[str, CustomerContext] = {}

    for item in request.requests:
        tx, ctx = _request_to_canonical(item)
        transactions.append(tx)
        # Later context for the same customer overwrites earlier — acceptable
        # for batch because the pipeline uses in-DataFrame history as fallback
        ctx_map[tx.customer_id] = ctx

    pipeline_result = run_feature_pipeline(
        transactions=transactions,
        customer_contexts=ctx_map,
        scaler=bundle.scaler,
    )

    X = pipeline_result.feature_matrix.values
    tx_ids = pipeline_result.transaction_ids

    fraud_probs   = _predict_fraud_probability_batch(bundle, X)
    anomaly_raw   = _predict_anomaly_score_batch(bundle, X)
    anomaly_scores = np.array([normalize_anomaly_score(s) for s in anomaly_raw])

    predictions: list[PredictResponse] = []
    for i in range(len(fraud_probs)):
        fp = float(fraud_probs[i])
        as_ = float(anomaly_scores[i])
        rs, rl = aggregate_risk_score(fp, as_)
        predictions.append(PredictResponse(
            fraud_probability=round(fp, 6),
            anomaly_score=round(as_, 6),
            risk_score=rs,
            risk_level=rl,  # type: ignore[arg-type]
            threshold=bundle.threshold,
            feature_contributions=[],
            model_version=bundle.model_version,
            feature_version=bundle.feature_version,
            processing_ms=0,   # per-item timing not tracked in batch
            model_status="READY",
        ))

    processing_ms = int((time.monotonic() - t_start) * 1000)
    logger.info(
        "Batch prediction: %d transactions processed in %dms",
        len(predictions),
        processing_ms,
    )

    return BatchPredictResponse(
        predictions=predictions,
        total=len(predictions),
        processing_ms=processing_ms,
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _require_model_ready(registry) -> None:
    if not registry.is_ready:
        h = registry.health_dict()
        raise HTTPException(
            status_code=503,
            detail={
                "error": "MODEL_NOT_READY",
                "message": (
                    "The ML model is not loaded. "
                    "Run the training pipeline and place artefacts in the model directory."
                ),
                "model_status": h.get("model_status"),
                "load_error":   h.get("load_error"),
            },
        )


def _request_to_canonical(
    req: PredictRequest,
) -> tuple[RawTransaction, CustomerContext]:
    """Convert a PredictRequest into (RawTransaction, CustomerContext)."""
    tx_payload  = req.transaction
    ctx_payload = req.customer_context

    tx = RawTransaction(
        transaction_id=tx_payload.transaction_id,
        merchant_id=tx_payload.merchant_id,
        customer_id=tx_payload.customer_id,
        timestamp=tx_payload.timestamp,
        amount=tx_payload.amount,
        currency=tx_payload.currency,
        payment_method=tx_payload.payment_method,
        device_id=tx_payload.device_id,
        ip_address=tx_payload.ip_address,
        billing_country=tx_payload.billing_country,
        shipping_country=tx_payload.shipping_country,
        merchant_category=tx_payload.merchant_category,
        email_domain=tx_payload.email_domain,
        data_source="API_EVENT",
        # is_refunded, is_fraud intentionally absent at inference time
    )

    ctx = CustomerContext(
        customer_id=tx_payload.customer_id,
        merchant_id=tx_payload.merchant_id,
        account_age_days=ctx_payload.account_age_days,
        historical_transaction_count=ctx_payload.historical_transaction_count,
        historical_total_amount=ctx_payload.historical_total_amount,
        historical_refund_count=ctx_payload.historical_refund_count,
        historical_device_count=ctx_payload.historical_device_count,
        historical_ip_count=ctx_payload.historical_ip_count,
        historical_fraud_rate=ctx_payload.historical_fraud_rate,
    )

    return tx, ctx


def _predict_fraud_probability(bundle, X: np.ndarray) -> float:
    """
    Run the XGBoost model (or calibrator if available) on a single row.
    Returns a float in [0, 1].
    """
    model = bundle.calibrator if bundle.calibrator is not None else bundle.xgb_model
    prob = _get_positive_class_prob(model, X)
    return float(prob[0])


def _predict_fraud_probability_batch(bundle, X: np.ndarray) -> np.ndarray:
    model = bundle.calibrator if bundle.calibrator is not None else bundle.xgb_model
    return _get_positive_class_prob(model, X)


def _get_positive_class_prob(model, X: np.ndarray) -> np.ndarray:
    """
    Extract P(fraud) from any sklearn-compatible model.
    Handles both predict_proba (returns shape (n, 2)) and predict (returns shape (n,)).
    """
    if hasattr(model, "predict_proba"):
        proba = model.predict_proba(X)
        # Binary classification: column 1 is P(fraud)
        return proba[:, 1] if proba.ndim == 2 else proba
    # Fallback: use raw prediction (XGBoost native Booster.predict returns proba)
    return model.predict(X)


def _predict_anomaly_score(bundle, X: np.ndarray) -> float:
    """Run Isolation Forest on a single row. Returns the raw score."""
    scores = bundle.isolation_forest.score_samples(X)
    return float(scores[0])


def _predict_anomaly_score_batch(bundle, X: np.ndarray) -> np.ndarray:
    return bundle.isolation_forest.score_samples(X)

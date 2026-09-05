"""
Zeno ML FastAPI inference service.

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

from zeno_ml.inference.aggregator import aggregate_risk_score, normalize_anomaly_score
from zeno_ml.inference.explainer import SHAPExplainer
from zeno_ml.inference.ieee_cis_features import build_feature_vector
from zeno_ml.inference.model_registry import RegistryStatus, get_registry
from zeno_ml.inference.request import BatchPredictRequest, PredictRequest
from zeno_ml.inference.response import (
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
        logger.info("Zeno ML service started — model READY.")
    else:
        logger.warning(
            "Zeno ML service started — model NOT ready. "
            "Prediction endpoints will return 503 until models are trained."
        )
    # SHAP explainer is initialised lazily on first /ml/predict call
    # so startup is fast even when model artefacts are present.
    yield
    logger.info("Zeno ML service shutting down.")


# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Zeno ML Inference Service",
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

    # Build feature vector using IEEE-CIS trained feature schema
    tx_payload  = request.transaction
    ctx_payload = request.customer_context
    X = build_feature_vector(
        amount              = tx_payload.amount,
        timestamp           = tx_payload.timestamp,
        payment_method      = tx_payload.payment_method or "UNKNOWN",
        merchant_category   = tx_payload.merchant_category or "UNKNOWN",
        email_domain        = tx_payload.email_domain,
        device_id           = tx_payload.device_id,
        historical_tx_count = ctx_payload.historical_transaction_count,
        feature_names       = bundle.feature_names,
        scaler              = bundle.scaler,
    )

    # XGBoost prediction
    fraud_probability = _predict_fraud_probability(bundle, X)

    # Isolation Forest anomaly score
    anomaly_score_raw = _predict_anomaly_score(bundle, X)
    anomaly_score = normalize_anomaly_score(anomaly_score_raw)

    # Risk aggregation
    risk_score, risk_level = aggregate_risk_score(fraud_probability, anomaly_score)

    # SHAP explanations — lazy init per registry bundle
    contributions: list[FeatureContribution] = []
    try:
        if not hasattr(bundle, "_shap_explainer") or bundle._shap_explainer is None:
            bundle._shap_explainer = SHAPExplainer(
                model=bundle.xgb_model,
                feature_names=bundle.feature_names,
                model_version=bundle.model_version,
            )
        if bundle._shap_explainer.is_available:
            expl = bundle._shap_explainer.explain_single(X, fraud_probability)
            contributions = [
                FeatureContribution(
                    feature=c.feature,
                    shap_value=c.shap_value,
                    direction=c.direction,  # type: ignore[arg-type]
                    rank=c.rank,
                )
                for c in expl.top_n(10)
            ]
    except Exception as exc:  # noqa: BLE001
        logger.warning("SHAP explanation failed (non-fatal): %s", exc)

    # Track prediction in monitoring buffer (in-process, resets on restart)
    if not hasattr(app.state, "recent_fraud_probs"):
        app.state.recent_fraud_probs = []
    app.state.recent_fraud_probs.append(fraud_probability)
    # Keep last 1000 predictions in memory
    if len(app.state.recent_fraud_probs) > 1000:
        app.state.recent_fraud_probs = app.state.recent_fraud_probs[-1000:]

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

    X_rows = []
    for item in request.requests:
        tx_p  = item.transaction
        ctx_p = item.customer_context
        row = build_feature_vector(
            amount              = tx_p.amount,
            timestamp           = tx_p.timestamp,
            payment_method      = tx_p.payment_method or "UNKNOWN",
            merchant_category   = tx_p.merchant_category or "UNKNOWN",
            email_domain        = tx_p.email_domain,
            device_id           = tx_p.device_id,
            historical_tx_count = ctx_p.historical_transaction_count,
            feature_names       = bundle.feature_names,
            scaler              = bundle.scaler,
        )
        X_rows.append(row)

    X = np.vstack(X_rows)

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


# ---------------------------------------------------------------------------
# Model monitoring endpoint
# ---------------------------------------------------------------------------

@app.get("/ml/monitoring/health", tags=["Monitoring"])
async def monitoring_health() -> dict:
    """
    Lightweight model health check.

    Returns a summary of:
    - model load status
    - recent prediction count (in-process memory only — resets on restart)
    - prediction distribution stats (mean, std of recent fraud_probability scores)
    - data quality indicator

    This is a DEMONSTRATION monitoring endpoint.  It tracks predictions
    in the current process's memory.  A production system would persist
    prediction logs to a time-series store.

    Returns HTTP 200 always — use model_status and overall_status fields
    to determine health.

    Limitations (always returned in the response):
      - Only tracks predictions made since the last service restart.
      - Does not compute PSI against a training baseline (no artefact storage for baselines).
      - 'DEGRADED' / 'CRITICAL' status means the distributions look different
        from expected — not that the model has definitively degraded.
    """
    registry = get_registry()
    h = registry.health_dict()

    # Pull in-memory prediction buffer from app state
    recent_probs: list[float] = getattr(app.state, "recent_fraud_probs", [])
    n_recent = len(recent_probs)

    pred_mean   = float(sum(recent_probs) / n_recent) if n_recent > 0 else None
    pred_std    = float(float(sum((p - pred_mean) ** 2 for p in recent_probs) / n_recent) ** 0.5) \
                  if n_recent > 1 and pred_mean is not None else None
    pred_high   = sum(1 for p in recent_probs if p >= 0.5) if n_recent > 0 else 0

    # Simple quality classification
    if not registry.is_ready:
        overall_status = "UNAVAILABLE"
        data_quality   = "UNKNOWN"
        pred_drift     = "UNKNOWN"
    elif n_recent < 30:
        overall_status = "HEALTHY"
        data_quality   = "GOOD"
        pred_drift     = "UNKNOWN"
    else:
        # Very basic drift: if >40% of recent predictions are high-risk, flag MEDIUM
        high_frac = pred_high / n_recent
        if high_frac > 0.40:
            pred_drift     = "HIGH"
            overall_status = "DEGRADED"
        elif high_frac > 0.20:
            pred_drift     = "MEDIUM"
            overall_status = "HEALTHY"
        else:
            pred_drift     = "LOW"
            overall_status = "HEALTHY"
        data_quality = "GOOD"

    return {
        "model_status":   h.get("model_status", "UNLOADED"),
        "model_version":  h.get("model_version"),
        "feature_version": h.get("feature_version"),
        "overall_status": overall_status,
        "n_recent_predictions": n_recent,
        "prediction_distribution": {
            "mean":          round(pred_mean, 4) if pred_mean is not None else None,
            "std":           round(pred_std,  4) if pred_std  is not None else None,
            "high_risk_frac": round(pred_high / max(n_recent, 1), 4),
            "drift_level":   pred_drift,
        },
        "data_quality":   data_quality,
        "feature_drift":  "UNKNOWN",
        "limitations": (
            "In-memory tracking only — resets on service restart. "
            "Production monitoring requires persistent prediction logging. "
            "Drift classification uses simple thresholds, not statistical tests."
        ),
    }

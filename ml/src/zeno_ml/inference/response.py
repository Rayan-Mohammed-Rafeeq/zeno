"""
Pydantic response models for the FastAPI ML inference endpoints.

Spring Boot deserializes these responses and maps them to its own
MlPredictionResponse DTO.  The schema here is the authoritative contract.
"""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

RiskLevel = Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]
ContributionDirection = Literal["POSITIVE", "NEGATIVE", "NEUTRAL"]


class FeatureContribution(BaseModel):
    """
    SHAP-derived contribution for a single feature.

    shap_value > 0 pushes towards fraud (POSITIVE direction).
    shap_value < 0 pushes away from fraud (NEGATIVE direction).
    """
    feature:    str
    shap_value: float
    direction:  ContributionDirection
    rank:       int = Field(description="1 = strongest contributor.")


class PredictResponse(BaseModel):
    """
    Complete ML prediction response.

    All numeric fields are produced by the ML pipeline — never hardcoded.
    Spring Boot must not interpret absence of feature_contributions as a
    successful prediction with no explanation; it should surface the
    model_status field to distinguish between the two cases.
    """
    # Core prediction
    fraud_probability: float = Field(
        ge=0.0, le=1.0,
        description="Calibrated fraud probability from XGBoost [0, 1].",
    )
    anomaly_score: float = Field(
        ge=0.0, le=1.0,
        description=(
            "Isolation Forest anomaly score normalised to [0, 1]. "
            "High = anomalous behaviour even if not matching fraud patterns."
        ),
    )
    risk_score: int = Field(
        ge=0, le=100,
        description="Aggregated risk score 0–100.",
    )
    risk_level: RiskLevel
    threshold:  float = Field(
        description="Decision threshold used. Optimised on validation data — not 0.5."
    )

    # Explainability
    feature_contributions: list[FeatureContribution] = Field(
        default_factory=list,
        description="Top SHAP contributors (positive + negative, up to 10 total).",
    )

    # Provenance
    model_version:   str
    feature_version: str
    processing_ms:   int = Field(description="Wall-clock inference time in milliseconds.")

    # Service status
    model_status: Literal["READY", "UNAVAILABLE"] = "READY"


class BatchPredictResponse(BaseModel):
    predictions:    list[PredictResponse]
    total:          int
    processing_ms:  int


class HealthResponse(BaseModel):
    """Response for GET /health."""
    service:         Literal["zeno-ml"] = "zeno-ml"
    status:          Literal["UP", "DEGRADED", "DOWN"]
    model_status:    str
    model_version:   Optional[str] = None
    feature_version: Optional[str] = None
    threshold:       Optional[float] = None
    feature_count:   Optional[int] = None
    load_error:      Optional[str] = None
    version:         str = "0.1.0"


class ModelInfoResponse(BaseModel):
    """Response for GET /ml/model-info."""
    model_version:   str
    feature_version: str
    threshold:       float
    feature_names:   list[str]
    metadata:        dict

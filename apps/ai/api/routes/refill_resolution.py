"""api/routes/refill_resolution.py — Refill resolution AI endpoint.

Spring Boot calls POST /api/ai/refill-resolution/analyze with a
RefillAnalysisRequest and receives a RefillAIRecommendation.
"""
from __future__ import annotations

import logging
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status

from api.app import get_shared_llm, verify_api_key
from core.logging import get_request_id
from workflows.refill_resolution.schemas import (
    RefillAIRecommendation,
    RefillAnalysisRequest,
)
from workflows.refill_resolution.workflow import run_refill_resolution

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/ai/refill-resolution",
    tags=["refill-resolution"],
)


@router.post(
    "/analyze",
    response_model=RefillAIRecommendation,
    summary="Analyze a blocked refill and produce a structured recommendation",
    description=(
        "Receives the full refill context from Spring Boot, runs the LangGraph "
        "refill resolution workflow, and returns a validated RefillAIRecommendation. "
        "The AI NEVER approves, denies, or makes clinical decisions. "
        "All clinical decisions remain with the human provider."
    ),
)
async def analyze_refill(
    request_body: RefillAnalysisRequest,
    http_request: Request,
    _auth: Annotated[None, Depends(verify_api_key)],
) -> RefillAIRecommendation:
    request_id = http_request.headers.get("X-Request-ID") or get_request_id() or str(uuid.uuid4())

    llm = get_shared_llm()
    if llm is None:
        logger.error(
            "LLM not available for refill analysis",
            extra={"request_id": request_id, "refill_id": request_body.refill_id},
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI service is not available — LLM provider failed to initialise. "
                   "Continue with manual workflow.",
        )

    logger.info(
        "Refill analysis requested",
        extra={
            "request_id": request_id,
            "refill_id": request_body.refill_id,
            "case_id": request_body.case_id,
            "blocker_type": request_body.refill_request.blocker_type,
            "organization_id": request_body.organization.organization_id,
        },
    )

    try:
        recommendation = run_refill_resolution(
            request_body,
            llm,
            run_id=request_id,
        )
        return recommendation

    except ValueError as exc:
        logger.error(
            "Refill analysis validation error",
            extra={
                "request_id": request_id,
                "refill_id": request_body.refill_id,
                "error": str(exc),
            },
        )
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Analysis failed: {exc}",
        ) from exc

    except Exception as exc:
        logger.error(
            "Refill analysis unexpected error",
            extra={
                "request_id": request_id,
                "refill_id": request_body.refill_id,
                "error": str(exc),
            },
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AI analysis encountered an internal error. Continue with manual workflow.",
        ) from exc

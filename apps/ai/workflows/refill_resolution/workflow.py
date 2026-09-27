"""workflows/refill_resolution/workflow.py — Public entry point for the refill resolution pack.

Spring Boot calls ``run_refill_resolution()`` via the FastAPI handler.
This is the only function the API layer needs to know about.
"""
from __future__ import annotations

import logging
import time
import uuid

from langchain_core.language_models import BaseChatModel

from workflows.refill_resolution.graph import (
    RefillResolutionState,
    build_refill_resolution_graph,
)
from workflows.refill_resolution.schemas import RefillAIRecommendation, RefillAnalysisRequest

logger = logging.getLogger(__name__)


def run_refill_resolution(
    request: RefillAnalysisRequest,
    llm: BaseChatModel,
    *,
    run_id: str | None = None,
) -> RefillAIRecommendation:
    """Run the refill resolution workflow and return a structured recommendation.

    Args:
        request: Validated input from Spring Boot.
        llm: LangChain chat model (real or mock).
        run_id: Optional stable identifier for this run.

    Returns:
        A validated RefillAIRecommendation.

    Raises:
        ValueError: If the graph produces no recommendation (should never happen
            as safety_gate/formatter always produce output).
    """
    effective_run_id = run_id or str(uuid.uuid4())
    started_at = time.monotonic()

    logger.info(
        "Starting refill resolution workflow",
        extra={
            "run_id": effective_run_id,
            "refill_id": request.refill_id,
            "case_id": request.case_id,
            "blocker_type": request.refill_request.blocker_type,
        },
    )

    graph = build_refill_resolution_graph(llm)

    initial_state: RefillResolutionState = {
        "request": request,
        "run_id": effective_run_id,
        "started_at": started_at,
        "validated_blocker": None,
        "blocker_context": {},
        "llm_output": None,
        "llm_raw": None,
        "llm_error": None,
        "llm_provider": "unknown",
        "llm_model": "unknown",
        "llm_latency_ms": 0,
        "recommendation": None,
        "error": None,
        "status": "starting",
    }

    final_state: RefillResolutionState = graph.invoke(
        initial_state,
        config={"configurable": {"thread_id": effective_run_id}},
    )

    recommendation = final_state.get("recommendation")
    if recommendation is None:
        raise ValueError(
            f"Refill resolution graph produced no recommendation for run_id={effective_run_id}"
        )

    total_ms = int((time.monotonic() - started_at) * 1000)
    logger.info(
        "Refill resolution workflow complete",
        extra={
            "run_id": effective_run_id,
            "refill_id": request.refill_id,
            "case_id": request.case_id,
            "recommended_action": recommendation.recommended_action,
            "safety_class": recommendation.safety_class,
            "confidence": recommendation.confidence,
            "total_latency_ms": total_ms,
        },
    )

    return recommendation

"""workflows/refill_resolution/graph.py — LangGraph refill resolution graph.

Graph flow:
  START
    ↓
  context_loader       (load and validate input)
    ↓
  blocker_interpreter  (interpret detected blocker)
    ↓
  evidence_validator   (ground-truth check on supplied data)
    ↓
  next_action_planner  (LLM: interpret and plan next action)
    ↓ (conditional: skip if LLM failed)
  safety_gate          (deterministic policy enforcement)
    ↓
  recommendation_formatter  (assemble final RefillAIRecommendation)
    ↓
  END

The LLM is invoked ONCE in next_action_planner.
All other nodes are deterministic.
"""
from __future__ import annotations

import json
import logging
import time
import uuid
from typing import Any

from langchain_core.exceptions import OutputParserException
from langchain_core.language_models import BaseChatModel
from langchain_core.output_parsers import JsonOutputParser
from langgraph.graph import END, StateGraph
from typing_extensions import TypedDict

from core.mock_llm import mock_output_schema_context
from core.security import sanitize_payload_for_prompt
from workflows.refill_resolution.policies.safety_gate import (
    assert_no_clinical_override,
    classify_action,
    requires_human_approval,
)
from workflows.refill_resolution.prompts.analysis_prompt import build_analysis_prompt
from workflows.refill_resolution.schemas import (
    ActionType,
    BlockerType,
    EvidenceItem,
    ModelMetadata,
    OwnerRole,
    ParallelDependency,
    PredictedNextBlocker,
    ProviderContextPacket,
    RefillAIRecommendation,
    RefillAnalysisRequest,
    SafetyClass,
    Urgency,
    _LLMReasoningOutput,
)

logger = logging.getLogger(__name__)

_MAX_JSON_BYTES = 256 * 1024  # 256 KiB max LLM response
_json_parser = JsonOutputParser()


# ─── Graph state ─────────────────────────────────────────────────────────────


class RefillResolutionState(TypedDict, total=False):
    """State shared across all graph nodes."""

    # Input
    request: RefillAnalysisRequest
    run_id: str
    started_at: float

    # Intermediate
    validated_blocker: BlockerType | None
    blocker_context: dict[str, Any]
    llm_output: _LLMReasoningOutput | None
    llm_raw: str | None
    llm_error: str | None
    llm_provider: str
    llm_model: str
    llm_latency_ms: int

    # Final
    recommendation: RefillAIRecommendation | None
    error: str | None
    status: str


# ─── Node implementations ─────────────────────────────────────────────────────


def context_loader_node(state: RefillResolutionState) -> RefillResolutionState:
    """Validate and prepare the request context."""
    request = state["request"]
    run_id = state.get("run_id", str(uuid.uuid4()))

    logger.info(
        "Refill resolution started",
        extra={
            "run_id": run_id,
            "refill_id": request.refill_id,
            "case_id": request.case_id,
            "blocker_type": request.refill_request.blocker_type,
            "organization_id": request.organization.organization_id,
        },
    )

    # Determine the effective blocker
    blocker_raw = request.refill_request.blocker_type or "OTHER"
    try:
        blocker = BlockerType(blocker_raw)
    except ValueError:
        blocker = BlockerType.OTHER

    # Build deterministic blocker context for downstream nodes
    rx = request.prescription
    blocker_context: dict[str, Any] = {
        "blocker": blocker,
        "is_expired": rx.is_expired,
        "is_out_of_refills": rx.is_out_of_refills,
        "refills_remaining": rx.refills_remaining,
        "refills_used": rx.refills_used,
        "refills_allowed": rx.refills_allowed,
        "requires_prior_auth": rx.requires_prior_auth,
        "has_existing_actions": len(request.existing_actions) > 0,
        "prior_attempts": sum(
            1 for a in request.existing_actions
            if a.status in ("COMPLETED", "CANCELLED")
        ),
    }

    return {
        **state,
        "run_id": run_id,
        "validated_blocker": blocker,
        "blocker_context": blocker_context,
        "status": "context_loaded",
    }


def blocker_interpreter_node(state: RefillResolutionState) -> RefillResolutionState:
    """Augment blocker context with structured interpretation data.

    This node does NOT call an LLM. It uses deterministic rules to add
    structural context that the LLM node will use.

    The deterministic Spring Boot rules already identified the blocker.
    This node helps the AI understand what data supports that blocker.
    """
    blocker = state["validated_blocker"]
    request = state["request"]
    rx = request.prescription
    ctx = dict(state["blocker_context"])

    # Attach blocker-specific evidence hints
    match blocker:
        case BlockerType.NO_REFILLS:
            ctx["evidence_hints"] = [
                f"refills_used ({rx.refills_used}) equals refills_allowed ({rx.refills_allowed})",
                "Prescription has no remaining refills authorized",
            ]
            ctx["typical_next_action"] = ActionType.REQUEST_PROVIDER_REVIEW
            ctx["typical_owner"] = OwnerRole.PROVIDER

        case BlockerType.NEW_PRESCRIPTION_REQUIRED:
            ctx["evidence_hints"] = [
                f"prescription expired on {rx.expiry_date}",
                "A new prescription must be written by the provider",
            ]
            ctx["typical_next_action"] = ActionType.REQUEST_PROVIDER_REVIEW
            ctx["typical_owner"] = OwnerRole.PROVIDER

        case BlockerType.PROVIDER_APPROVAL_REQUIRED:
            ctx["evidence_hints"] = [
                "prescription flagged as requiring prior authorization or explicit provider approval",
            ]
            ctx["typical_next_action"] = ActionType.REQUEST_PRIOR_AUTH
            ctx["typical_owner"] = OwnerRole.PRACTICE_STAFF

        case BlockerType.MISSING_INFORMATION:
            ctx["evidence_hints"] = [
                "one or more required prescription fields are missing",
            ]
            ctx["typical_next_action"] = ActionType.REQUEST_MISSING_INFORMATION
            ctx["typical_owner"] = OwnerRole.PRACTICE_STAFF

        case BlockerType.INSURANCE_BLOCK:
            ctx["evidence_hints"] = [
                "insurance or PBM flagged this prescription",
            ]
            ctx["typical_next_action"] = ActionType.CHECK_INSURANCE_STATUS
            ctx["typical_owner"] = OwnerRole.PHARMACY_STAFF

        case BlockerType.PHARMACY_ISSUE:
            ctx["evidence_hints"] = [
                "pharmacy-side issue preventing dispensing",
            ]
            ctx["typical_next_action"] = ActionType.CONTACT_PHARMACY
            ctx["typical_owner"] = OwnerRole.PHARMACIST

        case _:
            ctx["evidence_hints"] = ["blocker type requires manual review"]
            ctx["typical_next_action"] = ActionType.ESCALATE
            ctx["typical_owner"] = OwnerRole.PRACTICE_STAFF

    return {**state, "blocker_context": ctx, "status": "blocker_interpreted"}


def evidence_validator_node(state: RefillResolutionState) -> RefillResolutionState:
    """Ground-truth check: verify the blocker is consistent with supplied data.

    If the data contradicts the blocker (e.g. backend says NO_REFILLS but
    refills_remaining > 0), we flag it so the LLM sees the inconsistency.
    """
    blocker = state["validated_blocker"]
    rx = state["request"].prescription
    ctx = dict(state["blocker_context"])
    contradictions: list[str] = []

    if blocker == BlockerType.NO_REFILLS and rx.refills_remaining > 0:
        contradictions.append(
            f"Blocker is NO_REFILLS but refills_remaining={rx.refills_remaining} — possible data inconsistency"
        )
    if blocker == BlockerType.NEW_PRESCRIPTION_REQUIRED and not rx.is_expired:
        contradictions.append(
            "Blocker is NEW_PRESCRIPTION_REQUIRED but prescription is not marked as expired"
        )
    if blocker == BlockerType.PROVIDER_APPROVAL_REQUIRED and not rx.requires_prior_auth:
        contradictions.append(
            "Blocker is PROVIDER_APPROVAL_REQUIRED but requires_prior_auth=False"
        )

    ctx["contradictions"] = contradictions
    ctx["data_consistent"] = len(contradictions) == 0

    if contradictions:
        logger.warning(
            "Evidence contradictions detected",
            extra={
                "run_id": state.get("run_id"),
                "refill_id": state["request"].refill_id,
                "contradictions": contradictions,
            },
        )

    return {**state, "blocker_context": ctx, "status": "evidence_validated"}


def next_action_planner_node(
    state: RefillResolutionState, llm: BaseChatModel
) -> RefillResolutionState:
    """Invoke the LLM to interpret the blocker and plan the next action.

    This is the ONLY node that calls the LLM.
    All other nodes are deterministic.
    """
    request = state["request"]
    run_id = state.get("run_id", "unknown")

    llm_start = time.monotonic()
    provider_name = getattr(llm, "_llm_type", "unknown")
    model_name = getattr(llm, "model_name", getattr(llm, "model", "unknown"))

    try:
        prompt = build_analysis_prompt(request)

        logger.debug(
            "LLM invocation starting",
            extra={"run_id": run_id, "refill_id": request.refill_id},
        )

        with mock_output_schema_context(_LLMReasoningOutput):
            response = llm.invoke(prompt)

        raw = (
            response.content
            if hasattr(response, "content")
            else str(response)
        )
        if isinstance(raw, list):
            raw = " ".join(
                block.get("text", "") if isinstance(block, dict) else str(block)
                for block in raw
            )

        latency_ms = int((time.monotonic() - llm_start) * 1000)

        logger.info(
            "LLM invocation complete",
            extra={
                "run_id": run_id,
                "refill_id": request.refill_id,
                "latency_ms": latency_ms,
                "provider": provider_name,
            },
        )

        # Parse and validate LLM output
        if len(raw.encode("utf-8")) > _MAX_JSON_BYTES:
            raise ValueError("LLM response exceeds maximum allowed size")

        try:
            parsed_dict = _json_parser.parse(raw.strip())
        except OutputParserException as exc:
            raise ValueError(f"Could not parse JSON from LLM response: {exc}") from exc

        if not isinstance(parsed_dict, dict):
            raise ValueError(f"LLM response must be a JSON object, got: {type(parsed_dict)}")

        # Validate against the intermediate schema
        llm_output = _LLMReasoningOutput.model_validate(parsed_dict)

        return {
            **state,
            "llm_output": llm_output,
            "llm_raw": None,  # don't store raw for privacy
            "llm_error": None,
            "llm_provider": provider_name,
            "llm_model": model_name,
            "llm_latency_ms": latency_ms,
            "status": "llm_complete",
        }

    except Exception as exc:  # noqa: BLE001
        latency_ms = int((time.monotonic() - llm_start) * 1000)
        logger.error(
            "LLM invocation failed",
            extra={
                "run_id": run_id,
                "refill_id": request.refill_id,
                "error": str(exc),
                "latency_ms": latency_ms,
            },
        )
        return {
            **state,
            "llm_output": None,
            "llm_error": str(exc),
            "llm_provider": provider_name,
            "llm_model": model_name,
            "llm_latency_ms": latency_ms,
            "status": "llm_failed",
        }


def safety_gate_node(state: RefillResolutionState) -> RefillResolutionState:
    """Deterministic safety gate — runs AFTER LLM reasoning.

    Classifies the recommended action, enforces human approval requirements,
    and rejects any forbidden actions.

    This gate cannot be bypassed by model output.
    """
    llm_output = state.get("llm_output")
    blocker = state["validated_blocker"]
    ctx = state["blocker_context"]

    if llm_output is None:
        # LLM failed — fall back to deterministic defaults
        fallback_action = ctx.get("typical_next_action", ActionType.ESCALATE)
        fallback_role = ctx.get("typical_owner", OwnerRole.PRACTICE_STAFF)
        safety_class = classify_action(fallback_action)
        needs_approval = requires_human_approval(safety_class)

        logger.warning(
            "Safety gate using fallback (LLM failed)",
            extra={
                "run_id": state.get("run_id"),
                "fallback_action": str(fallback_action),
                "safety_class": str(safety_class),
            },
        )

        state = {
            **state,
            "llm_output": _LLMReasoningOutput(
                blocker_explanation=_fallback_explanation(blocker),
                confidence=0.5,
                evidence=[],
                missing_information=[],
                recommended_action=fallback_action,
                assigned_role=fallback_role,
                urgency=Urgency.NORMAL,
                rationale="AI service encountered an error. Deterministic fallback applied.",
                provider_context_needed=False,
                ui_summary=f"Blocker detected: {blocker.value}. Manual review required.",
                ui_next_step="Review case manually and determine next action.",
            ),
        }

    llm_out = state["llm_output"]

    # Safety check: reject forbidden actions
    try:
        assert_no_clinical_override(llm_out.recommended_action)
    except ValueError as exc:
        logger.error(
            "Safety gate blocked forbidden action",
            extra={
                "run_id": state.get("run_id"),
                "action": llm_out.recommended_action,
                "error": str(exc),
            },
        )
        # Force-replace with safe escalation
        state = {
            **state,
            "llm_output": _LLMReasoningOutput(
                **{
                    **llm_out.model_dump(),
                    "recommended_action": ActionType.ESCALATE,
                    "rationale": "Safety gate blocked the original recommendation. Escalation required.",
                }
            ),
        }
        llm_out = state["llm_output"]

    # Classify the action and set safety fields deterministically
    action = ActionType(llm_out.recommended_action)
    safety_class = classify_action(action)
    needs_approval = requires_human_approval(safety_class)

    # Clinical review tasks must always land with a provider, regardless of
    # the model's proposed administrative owner.
    if action == ActionType.REQUEST_PROVIDER_REVIEW:
        state = {
            **state,
            "llm_output": _LLMReasoningOutput(
                **{**llm_out.model_dump(), "assigned_role": OwnerRole.PROVIDER}
            ),
        }

    logger.info(
        "Safety gate evaluation complete",
        extra={
            "run_id": state.get("run_id"),
            "action": action,
            "safety_class": safety_class,
            "requires_human_approval": needs_approval,
        },
    )

    return {
        **state,
        "status": "safety_gate_passed",
        # Attach safety classification back to state for formatter
        "blocker_context": {
            **state["blocker_context"],
            "safety_class": safety_class,
            "requires_human_approval": needs_approval,
        },
    }


def recommendation_formatter_node(state: RefillResolutionState) -> RefillResolutionState:
    """Assemble the final RefillAIRecommendation from all node outputs."""
    request = state["request"]
    llm_out = state["llm_output"]
    ctx = state["blocker_context"]
    run_id = state.get("run_id", "unknown")
    started_at = state.get("started_at", time.monotonic())

    total_latency_ms = int((time.monotonic() - started_at) * 1000)
    safety_class = SafetyClass(ctx.get("safety_class", SafetyClass.HIGH_RISK_HUMAN_REVIEW))
    needs_approval = ctx.get("requires_human_approval", True)

    # Build provider context packet if needed
    provider_context: ProviderContextPacket | None = None
    if llm_out.provider_context_needed and llm_out.provider_summary:
        provider_context = ProviderContextPacket(
            summary=llm_out.provider_summary,
            reason_for_review=f"Provider review required for blocker: {state['validated_blocker'].value}",
            known_information=llm_out.provider_known_info,
            missing_information=llm_out.provider_missing_info,
            administrative_recommendation=llm_out.provider_admin_recommendation or (
                "Provider review and decision required to proceed with this refill."
            ),
            clinical_decision_required=True,
        )

    # Map next state based on recommended action
    next_state = _map_next_state(ActionType(llm_out.recommended_action))

    recommendation = RefillAIRecommendation(
        refill_id=request.refill_id,
        case_id=request.case_id,
        current_state=request.refill_request.status,
        blocker=state["validated_blocker"],
        blocker_explanation=llm_out.blocker_explanation,
        confidence=llm_out.confidence,
        evidence=llm_out.evidence,
        missing_information=llm_out.missing_information,
        recommended_action=ActionType(llm_out.recommended_action),
        assigned_role=OwnerRole(llm_out.assigned_role),
        urgency=Urgency(llm_out.urgency),
        rationale=llm_out.rationale,
        provider_context=provider_context,
        parallel_dependencies=llm_out.parallel_dependencies,
        requires_human_approval=needs_approval,
        safety_class=safety_class,
        next_state=next_state,
        predicted_next_blocker=llm_out.predicted_next_blocker,
        ui_summary=llm_out.ui_summary,
        ui_next_step=llm_out.ui_next_step,
        model_metadata=ModelMetadata(
            provider=state.get("llm_provider", "unknown"),
            model=state.get("llm_model", "unknown"),
            run_id=run_id,
            latency_ms=total_latency_ms,
            cost_usd=None,
        ),
    )

    logger.info(
        "Recommendation assembled",
        extra={
            "run_id": run_id,
            "refill_id": request.refill_id,
            "case_id": request.case_id,
            "recommended_action": recommendation.recommended_action,
            "assigned_role": recommendation.assigned_role,
            "confidence": recommendation.confidence,
            "safety_class": recommendation.safety_class,
            "requires_human_approval": recommendation.requires_human_approval,
            "latency_ms": total_latency_ms,
        },
    )

    return {**state, "recommendation": recommendation, "status": "done"}


# ─── Routing ──────────────────────────────────────────────────────────────────


def _route_after_llm(state: RefillResolutionState) -> str:
    """Route after the LLM node: always proceed to safety gate."""
    return "safety_gate"


# ─── Graph builder ────────────────────────────────────────────────────────────


def build_refill_resolution_graph(llm: BaseChatModel) -> Any:
    """Build and compile the refill resolution LangGraph.

    Args:
        llm: A LangChain chat model (real or mock).

    Returns:
        A compiled LangGraph StateGraph.
    """
    from functools import partial

    graph = StateGraph(RefillResolutionState)

    graph.add_node("context_loader", context_loader_node)
    graph.add_node("blocker_interpreter", blocker_interpreter_node)
    graph.add_node("evidence_validator", evidence_validator_node)
    graph.add_node("next_action_planner", partial(next_action_planner_node, llm=llm))
    graph.add_node("safety_gate", safety_gate_node)
    graph.add_node("recommendation_formatter", recommendation_formatter_node)

    graph.set_entry_point("context_loader")
    graph.add_edge("context_loader", "blocker_interpreter")
    graph.add_edge("blocker_interpreter", "evidence_validator")
    graph.add_edge("evidence_validator", "next_action_planner")
    graph.add_conditional_edges(
        "next_action_planner",
        _route_after_llm,
        {"safety_gate": "safety_gate"},
    )
    graph.add_edge("safety_gate", "recommendation_formatter")
    graph.add_edge("recommendation_formatter", END)

    return graph.compile()


# ─── Helpers ─────────────────────────────────────────────────────────────────


def _fallback_explanation(blocker: BlockerType | None) -> str:
    explanations = {
        BlockerType.NO_REFILLS: (
            "The prescription has no remaining refills. Provider authorization is required."
        ),
        BlockerType.NEW_PRESCRIPTION_REQUIRED: (
            "The prescription has expired. A new prescription must be issued."
        ),
        BlockerType.PROVIDER_APPROVAL_REQUIRED: (
            "This prescription requires prior authorization or explicit provider approval."
        ),
        BlockerType.MISSING_INFORMATION: (
            "Required information is missing from the prescription or patient record."
        ),
        BlockerType.INSURANCE_BLOCK: (
            "Insurance has flagged this prescription. Prior authorization may be required."
        ),
        BlockerType.PHARMACY_ISSUE: (
            "A pharmacy-side issue is preventing this refill from proceeding."
        ),
    }
    return explanations.get(blocker, "A blocker has been identified. Manual review required.")


def _map_next_state(action: ActionType) -> str:
    """Map a recommended action to the expected next workflow state."""
    mapping = {
        ActionType.REQUEST_PROVIDER_REVIEW: "AWAITING_PROVIDER",
        ActionType.PREPARE_PROVIDER_CONTEXT: "AWAITING_PROVIDER",
        ActionType.REQUEST_PRIOR_AUTH: "AWAITING_PROVIDER",
        ActionType.REQUEST_MISSING_INFORMATION: "ACTION_REQUIRED",
        ActionType.ROUTE_TO_PRACTICE_STAFF: "AWAITING_PRACTICE",
        ActionType.CHECK_INSURANCE_STATUS: "AWAITING_INSURANCE",
        ActionType.CONTACT_PHARMACY: "AWAITING_PHARMACY",
        ActionType.CONTACT_PATIENT: "ACTION_REQUIRED",
        ActionType.ESCALATE: "ESCALATED",
        ActionType.WAIT_FOR_EXTERNAL_RESPONSE: "BLOCKED",
        ActionType.RETRIAGE: "UNDER_REVIEW",
        ActionType.NO_ACTION_REQUIRED: "READY",
    }
    return mapping.get(action, "BLOCKED")

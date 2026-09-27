"""workflows/refill_resolution/schemas.py — Strongly typed I/O contracts.

Spring Boot sends RefillAnalysisRequest.
Zeno AI returns RefillAIRecommendation.

CRITICAL: Every field has validation. Malformed LLM output is rejected — never
silently accepted. The safety gate fields (requires_human_approval, safety_class)
are set deterministically AFTER the LLM reasoning step; they cannot be bypassed
by model output.
"""
from __future__ import annotations

from datetime import date
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field, field_validator


# ─── Enumerations ────────────────────────────────────────────────────────────


class BlockerType(StrEnum):
    NO_REFILLS = "NO_REFILLS"
    PROVIDER_APPROVAL_REQUIRED = "PROVIDER_APPROVAL_REQUIRED"
    NEW_PRESCRIPTION_REQUIRED = "NEW_PRESCRIPTION_REQUIRED"
    VISIT_REQUIRED = "VISIT_REQUIRED"
    MISSING_INFORMATION = "MISSING_INFORMATION"
    INSURANCE_BLOCK = "INSURANCE_BLOCK"
    PHARMACY_ISSUE = "PHARMACY_ISSUE"
    OTHER = "OTHER"


class ActionType(StrEnum):
    REQUEST_MISSING_INFORMATION = "REQUEST_MISSING_INFORMATION"
    ROUTE_TO_PRACTICE_STAFF = "ROUTE_TO_PRACTICE_STAFF"
    REQUEST_PROVIDER_REVIEW = "REQUEST_PROVIDER_REVIEW"
    PREPARE_PROVIDER_CONTEXT = "PREPARE_PROVIDER_CONTEXT"
    REQUEST_PRIOR_AUTH = "REQUEST_PRIOR_AUTH"
    CHECK_INSURANCE_STATUS = "CHECK_INSURANCE_STATUS"
    CONTACT_PHARMACY = "CONTACT_PHARMACY"
    CONTACT_PATIENT = "CONTACT_PATIENT"
    ESCALATE = "ESCALATE"
    WAIT_FOR_EXTERNAL_RESPONSE = "WAIT_FOR_EXTERNAL_RESPONSE"
    RETRIAGE = "RETRIAGE"
    NO_ACTION_REQUIRED = "NO_ACTION_REQUIRED"


class OwnerRole(StrEnum):
    PHARMACIST = "PHARMACIST"
    PHARMACY_STAFF = "PHARMACY_STAFF"
    PRACTICE_STAFF = "PRACTICE_STAFF"
    PROVIDER = "PROVIDER"
    EXTERNAL_INSURANCE = "EXTERNAL_INSURANCE"
    PATIENT = "PATIENT"


class Urgency(StrEnum):
    LOW = "LOW"
    NORMAL = "NORMAL"
    HIGH = "HIGH"
    URGENT = "URGENT"


class SafetyClass(StrEnum):
    LOW_RISK_ADMIN_ACTION = "LOW_RISK_ADMIN_ACTION"
    MEDIUM_RISK_CONFIRMATION = "MEDIUM_RISK_CONFIRMATION"
    HIGH_RISK_HUMAN_REVIEW = "HIGH_RISK_HUMAN_REVIEW"


# ─── Input payload from Spring Boot ──────────────────────────────────────────


class PatientContext(BaseModel):
    """Minimal patient context for AI reasoning. No unnecessary PHI."""
    patient_id: int = Field(description="Internal patient identifier")
    mrn: str | None = Field(default=None, description="Medical record number (de-identified reference only)")
    date_of_birth: date | None = Field(default=None)
    organization_id: int | None = Field(default=None)

    @field_validator("mrn", mode="before")
    @classmethod
    def _limit_mrn(cls, v: Any) -> Any:
        if isinstance(v, str) and len(v) > 50:
            return v[:50]
        return v


class PrescriptionContext(BaseModel):
    """Prescription state for AI reasoning — no personal details."""
    prescription_id: int
    medication_name: str = Field(max_length=255)
    medication_strength: str | None = Field(default=None, max_length=100)
    refills_allowed: int = Field(ge=0)
    refills_used: int = Field(ge=0)
    refills_remaining: int = Field(ge=0)
    written_date: date | None = Field(default=None)
    expiry_date: date | None = Field(default=None)
    is_expired: bool
    is_out_of_refills: bool
    requires_prior_auth: bool
    dea_schedule: str | None = Field(default=None, max_length=10)
    provider_id: int | None = Field(default=None)
    provider_name: str | None = Field(default=None, max_length=255)
    provider_specialty: str | None = Field(default=None, max_length=100)


class RefillRequestContext(BaseModel):
    """Refill request state."""
    refill_id: int
    status: str = Field(max_length=50)
    blocker_type: str | None = Field(default=None, max_length=50)
    priority: str = Field(default="NORMAL", max_length=20)
    notes: str | None = Field(default=None, max_length=2000)  # untrusted free-text


class ResolutionCaseContext(BaseModel):
    """Resolution case state."""
    case_id: int
    status: str = Field(max_length=50)
    reason: str | None = Field(default=None, max_length=2000)
    priority: str = Field(default="NORMAL", max_length=20)


class ExistingActionContext(BaseModel):
    """A previously created resolution action."""
    action_id: int
    action_type: str = Field(max_length=50)
    status: str = Field(max_length=50)
    assigned_role: str | None = Field(default=None, max_length=50)
    description: str | None = Field(default=None, max_length=500)
    created_at: str | None = Field(default=None)


class TimelineEvent(BaseModel):
    """A refill event from the audit log."""
    event_type: str = Field(max_length=80)
    description: str | None = Field(default=None, max_length=500)
    actor_label: str | None = Field(default=None, max_length=100)
    created_at: str | None = Field(default=None)


class OrganizationContext(BaseModel):
    """Organization context."""
    organization_id: int
    organization_type: str = Field(max_length=50)
    name: str = Field(max_length=255)


class RefillAnalysisRequest(BaseModel):
    """Complete input payload sent from Spring Boot to the AI service.

    Spring Boot assembles all required context and sends it in a single call.
    The AI service does not query the database directly.
    """
    refill_id: int
    case_id: int
    patient: PatientContext
    prescription: PrescriptionContext
    refill_request: RefillRequestContext
    resolution_case: ResolutionCaseContext
    existing_actions: list[ExistingActionContext] = Field(default_factory=list)
    timeline: list[TimelineEvent] = Field(default_factory=list, max_length=50)
    organization: OrganizationContext
    current_user_role: str = Field(max_length=50)


# ─── Output schemas ───────────────────────────────────────────────────────────


class EvidenceItem(BaseModel):
    """A single piece of evidence supporting the AI recommendation."""
    statement: str = Field(max_length=500, description="What the evidence shows")
    source: str = Field(max_length=100, description="Which data field this came from")


class BlockerInterpretation(BaseModel):
    """Structured interpretation of the detected blocker."""
    blocker_type: BlockerType
    plain_explanation: str = Field(
        max_length=500,
        description="Human-readable explanation suitable for pharmacy/practice staff"
    )
    missing_items: list[str] = Field(
        default_factory=list,
        description="Specific items that are missing or need action"
    )
    confidence: float = Field(ge=0.0, le=1.0)


class RecommendedAction(BaseModel):
    """The single next operational action Zeno recommends."""
    action_type: ActionType
    reason: str = Field(max_length=500)
    owner_role: OwnerRole
    urgency: Urgency
    requires_human_approval: bool
    safety_class: SafetyClass


class ProviderContextPacket(BaseModel):
    """Structured context packet prepared for provider review.

    AI may summarise supplied information.
    AI must NOT make clinical recommendations in this packet.
    The provider makes the final clinical decision.
    """
    summary: str = Field(max_length=1000)
    reason_for_review: str = Field(max_length=500)
    known_information: list[str] = Field(default_factory=list)
    missing_information: list[str] = Field(default_factory=list)
    administrative_recommendation: str = Field(
        max_length=500,
        description="Administrative-only context. NOT a clinical recommendation."
    )
    clinical_decision_required: bool = Field(default=True)


class ParallelDependency(BaseModel):
    """An independent administrative task that can proceed in parallel."""
    dependency_type: str = Field(max_length=100)
    description: str = Field(max_length=300)
    owner_role: OwnerRole
    can_proceed_in_parallel: bool = Field(default=True)


class PredictedNextBlocker(BaseModel):
    """Lightweight prediction of what blocker may emerge after current one resolves."""
    blocker_type: BlockerType
    confidence: float = Field(ge=0.0, le=1.0)
    rationale: str = Field(max_length=300)


class ModelMetadata(BaseModel):
    """Metadata about the AI model invocation."""
    provider: str = Field(max_length=50)
    model: str = Field(max_length=100)
    run_id: str = Field(max_length=100)
    latency_ms: int = Field(ge=0)
    cost_usd: float | None = Field(default=None, ge=0.0)


# ─── The main recommendation output ─────────────────────────────────────────


class RefillAIRecommendation(BaseModel):
    """Complete structured recommendation from Zeno AI.

    This is what Spring Boot receives and stores in resolution_cases.ai_recommendation.

    IMPORTANT:
    - requires_human_approval and safety_class are set by the deterministic
      safety gate AFTER LLM reasoning. They cannot be overridden by the model.
    - AI cannot approve/deny prescriptions, change medications, or determine
      clinical appropriateness.
    """
    # Identification
    refill_id: int
    case_id: int

    # State
    current_state: str = Field(max_length=50)
    blocker: BlockerType

    # Interpretation
    blocker_explanation: str = Field(
        max_length=800,
        description="Plain-language explanation for staff"
    )
    confidence: float = Field(ge=0.0, le=1.0)

    # Evidence
    evidence: list[EvidenceItem] = Field(default_factory=list)
    missing_information: list[str] = Field(default_factory=list)

    # Recommended next step
    recommended_action: ActionType
    assigned_role: OwnerRole
    urgency: Urgency
    rationale: str = Field(max_length=800)

    # Provider context (populated when provider review is required)
    provider_context: ProviderContextPacket | None = Field(default=None)

    # Parallel dependencies
    parallel_dependencies: list[ParallelDependency] = Field(default_factory=list)

    # Safety (set deterministically, not by LLM)
    requires_human_approval: bool
    safety_class: SafetyClass

    # Intelligence
    next_state: str = Field(max_length=50)
    predicted_next_blocker: PredictedNextBlocker | None = Field(default=None)

    # UI explainability fields
    ui_summary: str = Field(
        max_length=500,
        description="Single sentence summary suitable for the Zeno Intelligence panel"
    )
    ui_next_step: str = Field(
        max_length=300,
        description="Clear description of what should happen next"
    )

    # Metadata
    model_metadata: ModelMetadata


# ─── LLM intermediate output (before safety gate) ────────────────────────────


class _LLMReasoningOutput(BaseModel):
    """Intermediate output from the LLM reasoning step.

    This schema is what the LLM produces. The safety gate then validates
    and potentially overrides safety-critical fields before producing
    RefillAIRecommendation.
    """
    blocker_explanation: str = Field(max_length=800)
    confidence: float = Field(ge=0.0, le=1.0)
    evidence: list[EvidenceItem] = Field(default_factory=list)
    missing_information: list[str] = Field(default_factory=list)
    recommended_action: ActionType
    assigned_role: OwnerRole
    urgency: Urgency
    rationale: str = Field(max_length=800)
    provider_context_needed: bool = Field(default=False)
    provider_summary: str | None = Field(default=None, max_length=1000)
    provider_known_info: list[str] = Field(default_factory=list)
    provider_missing_info: list[str] = Field(default_factory=list)
    provider_admin_recommendation: str | None = Field(default=None, max_length=500)
    parallel_dependencies: list[ParallelDependency] = Field(default_factory=list)
    predicted_next_blocker: PredictedNextBlocker | None = Field(default=None)
    ui_summary: str = Field(max_length=500)
    ui_next_step: str = Field(max_length=300)

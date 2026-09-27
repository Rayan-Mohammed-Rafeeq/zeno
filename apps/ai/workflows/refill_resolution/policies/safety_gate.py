"""workflows/refill_resolution/policies/safety_gate.py — Deterministic safety gate.

This is one of the most important components in Zeno AI.

The safety gate runs AFTER LLM reasoning and BEFORE the recommendation is
returned to Spring Boot. It:

1. Classifies every recommended action into a safety tier.
2. Forces requires_human_approval=True for all HIGH_RISK actions.
3. Prevents the AI from ever returning approval/denial of a prescription.
4. Cannot be bypassed by model output.

Principle: AI interprets. Rules control. Humans decide.
"""
from __future__ import annotations

from workflows.refill_resolution.schemas import ActionType, SafetyClass

# ─── Action classification table ─────────────────────────────────────────────
# Every known action type is explicitly classified.
# Unknown actions default to HIGH_RISK (fail safe).

_ACTION_SAFETY: dict[ActionType, SafetyClass] = {
    # Administrative interpretation — LOW risk
    ActionType.REQUEST_MISSING_INFORMATION: SafetyClass.LOW_RISK_ADMIN_ACTION,
    ActionType.CONTACT_PHARMACY: SafetyClass.LOW_RISK_ADMIN_ACTION,
    ActionType.CONTACT_PATIENT: SafetyClass.LOW_RISK_ADMIN_ACTION,
    ActionType.CHECK_INSURANCE_STATUS: SafetyClass.LOW_RISK_ADMIN_ACTION,
    ActionType.NO_ACTION_REQUIRED: SafetyClass.LOW_RISK_ADMIN_ACTION,

    # Administrative tasks that affect routing — MEDIUM risk (confirmation required)
    ActionType.ROUTE_TO_PRACTICE_STAFF: SafetyClass.MEDIUM_RISK_CONFIRMATION,
    ActionType.WAIT_FOR_EXTERNAL_RESPONSE: SafetyClass.MEDIUM_RISK_CONFIRMATION,
    ActionType.PREPARE_PROVIDER_CONTEXT: SafetyClass.MEDIUM_RISK_CONFIRMATION,
    ActionType.RETRIAGE: SafetyClass.MEDIUM_RISK_CONFIRMATION,

    # Clinical or consequential — HIGH risk (human approval always required)
    ActionType.REQUEST_PROVIDER_REVIEW: SafetyClass.HIGH_RISK_HUMAN_REVIEW,
    ActionType.REQUEST_PRIOR_AUTH: SafetyClass.HIGH_RISK_HUMAN_REVIEW,
    ActionType.ESCALATE: SafetyClass.HIGH_RISK_HUMAN_REVIEW,
}


def classify_action(action_type: ActionType) -> SafetyClass:
    """Deterministically classify an action type into a safety tier.

    Unknown action types default to HIGH_RISK_HUMAN_REVIEW (fail safe).
    """
    return _ACTION_SAFETY.get(action_type, SafetyClass.HIGH_RISK_HUMAN_REVIEW)


def requires_human_approval(safety_class: SafetyClass) -> bool:
    """Return True when human approval is mandatory.

    HIGH_RISK_HUMAN_REVIEW always requires human approval.
    MEDIUM_RISK_CONFIRMATION requires confirmation.
    LOW_RISK_ADMIN_ACTION does not require explicit approval.

    Note: Even LOW_RISK actions are presented to the user — the AI never
    silently performs actions. This flag controls whether the UI shows
    a mandatory approval prompt.
    """
    return safety_class in (
        SafetyClass.HIGH_RISK_HUMAN_REVIEW,
        SafetyClass.MEDIUM_RISK_CONFIRMATION,
    )


# ─── Forbidden actions ────────────────────────────────────────────────────────
# These action types must never appear in a Zeno AI recommendation.
# If an LLM somehow produces one, it is rejected entirely.

FORBIDDEN_ACTIONS: frozenset[str] = frozenset({
    "APPROVE_PRESCRIPTION",
    "DENY_PRESCRIPTION",
    "CHANGE_MEDICATION",
    "CHANGE_DOSAGE",
    "PRESCRIBE",
    "DIAGNOSE",
    "DETERMINE_TREATMENT",
    "AUTONOMOUS_CLINICAL_DECISION",
})


def assert_no_clinical_override(action_type_raw: str) -> None:
    """Raise ValueError if the action type is clinically forbidden.

    Called before building the final recommendation — ensures the LLM
    could never produce a recommendation that bypasses the human-in-the-loop.
    """
    if action_type_raw.upper() in FORBIDDEN_ACTIONS:
        raise ValueError(
            f"AI recommendation blocked by safety gate: "
            f"action type '{action_type_raw}' is not permitted in Zeno AI. "
            "Clinical decisions require human authorization."
        )

"""tests/conftest.py — Shared test fixtures."""
from __future__ import annotations

import os
from datetime import date

import pytest
from fastapi.testclient import TestClient

# Force mock provider in all tests
os.environ["LLM_PROVIDER"] = "mock"
os.environ["ENVIRONMENT"] = "development"
os.environ["AI_SERVICE_API_KEY"] = ""

from workflows.refill_resolution.schemas import (
    ExistingActionContext,
    OrganizationContext,
    PatientContext,
    PrescriptionContext,
    RefillAnalysisRequest,
    RefillRequestContext,
    ResolutionCaseContext,
    TimelineEvent,
)


def _make_prescription(
    *,
    refills_allowed: int = 3,
    refills_used: int = 3,
    refills_remaining: int = 0,
    is_expired: bool = False,
    is_out_of_refills: bool = True,
    requires_prior_auth: bool = False,
    expiry_date: date | None = None,
) -> PrescriptionContext:
    return PrescriptionContext(
        prescription_id=101,
        medication_name="Atorvastatin",
        medication_strength="20 mg",
        refills_allowed=refills_allowed,
        refills_used=refills_used,
        refills_remaining=refills_remaining,
        written_date=date(2025, 1, 15),
        expiry_date=expiry_date or date(2026, 1, 15),
        is_expired=is_expired,
        is_out_of_refills=is_out_of_refills,
        requires_prior_auth=requires_prior_auth,
        provider_id=5,
        provider_name="Dr. Jane Smith",
        provider_specialty="Internal Medicine",
    )


@pytest.fixture
def no_refills_request() -> RefillAnalysisRequest:
    """Demo scenario: Sarah Wilson, Atorvastatin 20mg, no refills remaining."""
    return RefillAnalysisRequest(
        refill_id=1001,
        case_id=201,
        patient=PatientContext(patient_id=42, mrn="MRN-0042", organization_id=1),
        prescription=_make_prescription(),
        refill_request=RefillRequestContext(
            refill_id=1001,
            status="AWAITING_PROVIDER",
            blocker_type="NO_REFILLS",
            priority="NORMAL",
        ),
        resolution_case=ResolutionCaseContext(
            case_id=201,
            status="OPEN",
            reason="Prescription has used all 3 authorized refills.",
            priority="NORMAL",
        ),
        existing_actions=[
            ExistingActionContext(
                action_id=301,
                action_type="REQUEST_PROVIDER_APPROVAL",
                status="PENDING",
                assigned_role="PROVIDER",
                description="Contact provider to authorize additional refills.",
            )
        ],
        timeline=[
            TimelineEvent(
                event_type="REFILL_REQUESTED",
                description="Pharmacy submitted refill request",
                actor_label="pharmacist",
                created_at="2026-09-27T09:00:00",
            ),
            TimelineEvent(
                event_type="BLOCKER_IDENTIFIED",
                description="NO_REFILLS blocker detected by triage engine",
                actor_label="triage-engine",
                created_at="2026-09-27T09:01:00",
            ),
        ],
        organization=OrganizationContext(
            organization_id=1,
            organization_type="PHARMACY",
            name="Main Street Pharmacy",
        ),
        current_user_role="PHARMACIST",
    )


@pytest.fixture
def expired_prescription_request() -> RefillAnalysisRequest:
    return RefillAnalysisRequest(
        refill_id=1002,
        case_id=202,
        patient=PatientContext(patient_id=43, mrn="MRN-0043", organization_id=1),
        prescription=_make_prescription(
            refills_allowed=3,
            refills_used=1,
            refills_remaining=2,
            is_expired=True,
            is_out_of_refills=False,
            expiry_date=date(2025, 6, 1),
        ),
        refill_request=RefillRequestContext(
            refill_id=1002,
            status="AWAITING_PROVIDER",
            blocker_type="NEW_PRESCRIPTION_REQUIRED",
            priority="HIGH",
        ),
        resolution_case=ResolutionCaseContext(
            case_id=202,
            status="OPEN",
            reason="Prescription expired on 2025-06-01.",
            priority="HIGH",
        ),
        existing_actions=[],
        timeline=[],
        organization=OrganizationContext(
            organization_id=1,
            organization_type="PHARMACY",
            name="Main Street Pharmacy",
        ),
        current_user_role="PHARMACY_STAFF",
    )


@pytest.fixture
def prior_auth_request() -> RefillAnalysisRequest:
    return RefillAnalysisRequest(
        refill_id=1003,
        case_id=203,
        patient=PatientContext(patient_id=44, mrn="MRN-0044", organization_id=2),
        prescription=_make_prescription(
            refills_allowed=6,
            refills_used=2,
            refills_remaining=4,
            is_expired=False,
            is_out_of_refills=False,
            requires_prior_auth=True,
        ),
        refill_request=RefillRequestContext(
            refill_id=1003,
            status="AWAITING_PROVIDER",
            blocker_type="PROVIDER_APPROVAL_REQUIRED",
            priority="URGENT",
        ),
        resolution_case=ResolutionCaseContext(
            case_id=203,
            status="OPEN",
            reason="Prior authorization required.",
            priority="URGENT",
        ),
        existing_actions=[],
        timeline=[],
        organization=OrganizationContext(
            organization_id=2,
            organization_type="PRACTICE",
            name="City Medical Practice",
        ),
        current_user_role="PRACTICE_STAFF",
    )


@pytest.fixture
def missing_info_request() -> RefillAnalysisRequest:
    return RefillAnalysisRequest(
        refill_id=1004,
        case_id=204,
        patient=PatientContext(patient_id=45, organization_id=1),
        prescription=PrescriptionContext(
            prescription_id=104,
            medication_name="Metformin",
            refills_allowed=3,
            refills_used=0,
            refills_remaining=3,
            is_expired=False,
            is_out_of_refills=False,
            requires_prior_auth=False,
            medication_strength=None,  # missing
            quantity_dispensed=None,   # type: ignore[call-arg]
        ),
        refill_request=RefillRequestContext(
            refill_id=1004,
            status="ACTION_REQUIRED",
            blocker_type="MISSING_INFORMATION",
            priority="NORMAL",
        ),
        resolution_case=ResolutionCaseContext(
            case_id=204,
            status="OPEN",
            reason="Medication strength is missing.",
            priority="NORMAL",
        ),
        existing_actions=[],
        timeline=[],
        organization=OrganizationContext(
            organization_id=1,
            organization_type="PHARMACY",
            name="Main Street Pharmacy",
        ),
        current_user_role="PHARMACY_STAFF",
    )


@pytest.fixture
def test_client() -> TestClient:
    from core.config import get_settings
    get_settings.cache_clear()

    import api.app as app_module
    from core.mock_llm import MockProviderChatModel

    from api.app import create_app
    app = create_app()
    # Inject mock LLM before requests — TestClient runs lifespan asynchronously
    # but we want to guarantee the LLM is present in all test scenarios.
    app_module._shared_llm = MockProviderChatModel()
    return TestClient(app)

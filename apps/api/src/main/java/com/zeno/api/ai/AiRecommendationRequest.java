package com.zeno.api.ai;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;
import lombok.Value;
import lombok.extern.jackson.Jacksonized;

import java.time.LocalDate;
import java.util.List;

/**
 * Request payload sent from Spring Boot to the Zeno AI service.
 *
 * Architecture: Spring Boot assembles all necessary context and sends it in a
 * single call. The AI service does NOT query the database directly — this is
 * the only entry point for case data into the AI layer.
 *
 * PHI minimization: Only fields required for administrative workflow reasoning
 * are included. Full patient demographics, addresses, and clinical notes are
 * deliberately excluded.
 */
@Value
@Builder
@Jacksonized
public class AiRecommendationRequest {

    @JsonProperty("refill_id")
    Long refillId;

    @JsonProperty("case_id")
    Long caseId;

    PatientContext patient;

    PrescriptionContext prescription;

    @JsonProperty("refill_request")
    RefillRequestContext refillRequest;

    @JsonProperty("resolution_case")
    ResolutionCaseContext resolutionCase;

    @JsonProperty("existing_actions")
    List<ExistingActionContext> existingActions;

    List<TimelineEvent> timeline;

    OrganizationContext organization;

    @JsonProperty("current_user_role")
    String currentUserRole;

    // ── Nested DTOs ──────────────────────────────────────────────────────────

    @Value
    @Builder
    @Jacksonized
    public static class PatientContext {
        @JsonProperty("patient_id")
        Long patientId;

        String mrn;

        @JsonProperty("date_of_birth")
        LocalDate dateOfBirth;

        @JsonProperty("organization_id")
        Long organizationId;
    }

    @Value
    @Builder
    @Jacksonized
    public static class PrescriptionContext {
        @JsonProperty("prescription_id")
        Long prescriptionId;

        @JsonProperty("medication_name")
        String medicationName;

        @JsonProperty("medication_strength")
        String medicationStrength;

        @JsonProperty("refills_allowed")
        int refillsAllowed;

        @JsonProperty("refills_used")
        int refillsUsed;

        @JsonProperty("refills_remaining")
        int refillsRemaining;

        @JsonProperty("written_date")
        LocalDate writtenDate;

        @JsonProperty("expiry_date")
        LocalDate expiryDate;

        @JsonProperty("is_expired")
        boolean isExpired;

        @JsonProperty("is_out_of_refills")
        boolean isOutOfRefills;

        @JsonProperty("requires_prior_auth")
        boolean requiresPriorAuth;

        @JsonProperty("dea_schedule")
        String deaSchedule;

        @JsonProperty("provider_id")
        Long providerId;

        @JsonProperty("provider_name")
        String providerName;

        @JsonProperty("provider_specialty")
        String providerSpecialty;
    }

    @Value
    @Builder
    @Jacksonized
    public static class RefillRequestContext {
        @JsonProperty("refill_id")
        Long refillId;

        String status;

        @JsonProperty("blocker_type")
        String blockerType;

        String priority;

        String notes;
    }

    @Value
    @Builder
    @Jacksonized
    public static class ResolutionCaseContext {
        @JsonProperty("case_id")
        Long caseId;

        String status;
        String reason;
        String priority;
    }

    @Value
    @Builder
    @Jacksonized
    public static class ExistingActionContext {
        @JsonProperty("action_id")
        Long actionId;

        @JsonProperty("action_type")
        String actionType;

        String status;

        @JsonProperty("assigned_role")
        String assignedRole;

        String description;

        @JsonProperty("created_at")
        String createdAt;
    }

    @Value
    @Builder
    @Jacksonized
    public static class TimelineEvent {
        @JsonProperty("event_type")
        String eventType;

        String description;

        @JsonProperty("actor_label")
        String actorLabel;

        @JsonProperty("created_at")
        String createdAt;
    }

    @Value
    @Builder
    @Jacksonized
    public static class OrganizationContext {
        @JsonProperty("organization_id")
        Long organizationId;

        @JsonProperty("organization_type")
        String organizationType;

        String name;
    }
}

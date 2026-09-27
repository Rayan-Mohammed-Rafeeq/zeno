package com.zeno.api.ai;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Structured recommendation received from the Zeno AI service.
 *
 * Maps to the Python RefillAIRecommendation schema.
 *
 * IMPORTANT: Receiving this response does NOT trigger any automatic action.
 * Spring Boot validates the recommendation and presents it to a human for
 * approval before any state transition occurs.
 *
 * {@code @JsonIgnoreProperties(ignoreUnknown = true)} ensures backward
 * compatibility if the AI service adds new fields.
 */
@Data
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class AiRecommendationResponse {

    @JsonProperty("refill_id")
    private Long refillId;

    @JsonProperty("case_id")
    private Long caseId;

    @JsonProperty("current_state")
    private String currentState;

    private String blocker;

    @JsonProperty("blocker_explanation")
    private String blockerExplanation;

    private Double confidence;

    private List<EvidenceItem> evidence;

    @JsonProperty("missing_information")
    private List<String> missingInformation;

    @JsonProperty("recommended_action")
    private String recommendedAction;

    @JsonProperty("assigned_role")
    private String assignedRole;

    private String urgency;

    private String rationale;

    @JsonProperty("provider_context")
    private ProviderContextPacket providerContext;

    @JsonProperty("parallel_dependencies")
    private List<ParallelDependency> parallelDependencies;

    @JsonProperty("requires_human_approval")
    private Boolean requiresHumanApproval;

    @JsonProperty("safety_class")
    private String safetyClass;

    @JsonProperty("next_state")
    private String nextState;

    @JsonProperty("predicted_next_blocker")
    private PredictedNextBlocker predictedNextBlocker;

    @JsonProperty("ui_summary")
    private String uiSummary;

    @JsonProperty("ui_next_step")
    private String uiNextStep;

    @JsonProperty("model_metadata")
    private ModelMetadata modelMetadata;

    // ── Nested response types ────────────────────────────────────────────────

    @Data
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class EvidenceItem {
        private String statement;
        private String source;
    }

    @Data
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ProviderContextPacket {
        private String summary;

        @JsonProperty("reason_for_review")
        private String reasonForReview;

        @JsonProperty("known_information")
        private List<String> knownInformation;

        @JsonProperty("missing_information")
        private List<String> missingInformation;

        @JsonProperty("administrative_recommendation")
        private String administrativeRecommendation;

        @JsonProperty("clinical_decision_required")
        private Boolean clinicalDecisionRequired;
    }

    @Data
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ParallelDependency {
        @JsonProperty("dependency_type")
        private String dependencyType;

        private String description;

        @JsonProperty("owner_role")
        private String ownerRole;

        @JsonProperty("can_proceed_in_parallel")
        private Boolean canProceedInParallel;
    }

    @Data
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class PredictedNextBlocker {
        @JsonProperty("blocker_type")
        private String blockerType;

        private Double confidence;
        private String rationale;
    }

    @Data
    @NoArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class ModelMetadata {
        private String provider;
        private String model;

        @JsonProperty("run_id")
        private String runId;

        @JsonProperty("latency_ms")
        private Integer latencyMs;

        @JsonProperty("cost_usd")
        private Double costUsd;
    }
}

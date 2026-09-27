package com.zeno.api.ai;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.zeno.api.refill.RefillEventRepository;
import com.zeno.api.refill.RefillEventType;
import com.zeno.api.refill.RefillRequest;
import com.zeno.api.resolution.ResolutionAction;
import com.zeno.api.resolution.ResolutionActionRepository;
import com.zeno.api.resolution.ResolutionCase;
import com.zeno.api.resolution.ResolutionCaseRepository;
import com.zeno.api.resolution.ResolutionRecommendationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Real implementation of ResolutionRecommendationService.
 *
 * Replaces StubResolutionRecommendationService.
 * Marked @Primary so Spring Boot auto-wires this over the stub.
 *
 * Flow:
 *   1. Build context payload from domain entities (no PHI excess)
 *   2. Call Zeno AI service via AiServiceClient
 *   3. On success: serialize recommendation to JSON, return to caller
 *   4. On failure: return Optional.empty() — never blocks workflow
 *
 * IMPORTANT: This service READS domain state. It does NOT write.
 * Writing (persisting the recommendation, recording events) is done by
 * ResolutionCaseService and the caller, so transactional semantics remain clean.
 */
@Service
@Primary
public class AiResolutionRecommendationService implements ResolutionRecommendationService {

    private static final Logger log = LoggerFactory.getLogger(AiResolutionRecommendationService.class);

    private final AiServiceClient aiServiceClient;
    private final AiRequestContextBuilder contextBuilder;
    private final ResolutionActionRepository actionRepository;
    private final ObjectMapper objectMapper;

    public AiResolutionRecommendationService(
            AiServiceClient aiServiceClient,
            AiRequestContextBuilder contextBuilder,
            ResolutionActionRepository actionRepository,
            ObjectMapper objectMapper
    ) {
        this.aiServiceClient = aiServiceClient;
        this.contextBuilder = contextBuilder;
        this.actionRepository = actionRepository;
        this.objectMapper = objectMapper;
    }

    /**
     * Request an AI recommendation for a blocked resolution case.
     *
     * Returns Optional.empty() on any error — the refill workflow continues
     * without AI assistance when the AI service is unavailable.
     *
     * @param resolutionCase The resolution case for the blocked refill
     * @param refillRequest  The associated refill request
     * @return Optional JSON string of the recommendation, or empty if unavailable
     */
    @Override
    @Transactional(readOnly = true)
    public Optional<String> getRecommendation(ResolutionCase resolutionCase, RefillRequest refillRequest) {
        if (!aiServiceClient.isEnabled()) {
            log.debug("AI service disabled — returning empty [caseId={}]", resolutionCase.getId());
            return Optional.empty();
        }

        String correlationId = UUID.randomUUID().toString();

        log.info("Requesting AI recommendation [caseId={}, refillId={}, correlationId={}]",
                resolutionCase.getId(), refillRequest.getId(), correlationId);

        try {
            List<ResolutionAction> existingActions =
                    actionRepository.findByResolutionCaseIdOrderByCreatedAtAsc(resolutionCase.getId());

            // Determine user role from context (default to SYSTEM for service-level calls)
            String userRole = resolveCurrentUserRole();

            AiRecommendationRequest request = contextBuilder.build(
                    resolutionCase, refillRequest, existingActions, userRole
            );

            Optional<AiRecommendationResponse> response =
                    aiServiceClient.analyze(request, correlationId);

            if (response.isEmpty()) {
                log.warn("AI service returned no recommendation [caseId={}, correlationId={}]",
                        resolutionCase.getId(), correlationId);
                return Optional.empty();
            }

            AiRecommendationResponse recommendation = response.get();

            // Serialize to JSON for storage in resolution_cases.ai_recommendation
            String recommendationJson = objectMapper.writeValueAsString(recommendation);

            log.info("AI recommendation serialized [caseId={}, action={}, safety={}, confidence={}]",
                    resolutionCase.getId(),
                    recommendation.getRecommendedAction(),
                    recommendation.getSafetyClass(),
                    recommendation.getConfidence());

            return Optional.of(recommendationJson);

        } catch (JsonProcessingException e) {
            log.error("Failed to serialize AI recommendation [caseId={}, correlationId={}, error={}]",
                    resolutionCase.getId(), correlationId, e.getMessage());
            return Optional.empty();
        } catch (Exception e) {
            log.error("Unexpected error requesting AI recommendation [caseId={}, correlationId={}, error={}]",
                    resolutionCase.getId(), correlationId, e.getMessage());
            return Optional.empty();
        }
    }

    @Override
    public boolean isAvailable() {
        return aiServiceClient.isEnabled() && aiServiceClient.isHealthy();
    }

    /**
     * Get structured recommendation (typed, not just JSON string).
     *
     * Used by the recommendation endpoint to return a rich response.
     */
    @Transactional(readOnly = true)
    public Optional<AiRecommendationResponse> getStructuredRecommendation(
            ResolutionCase resolutionCase,
            RefillRequest refillRequest,
            String currentUserRole
    ) {
        if (!aiServiceClient.isEnabled()) {
            return Optional.empty();
        }

        String correlationId = UUID.randomUUID().toString();

        try {
            List<ResolutionAction> existingActions =
                    actionRepository.findByResolutionCaseIdOrderByCreatedAtAsc(resolutionCase.getId());

            AiRecommendationRequest request = contextBuilder.build(
                    resolutionCase, refillRequest, existingActions,
                    currentUserRole != null ? currentUserRole : resolveCurrentUserRole()
            );

            return aiServiceClient.analyze(request, correlationId);

        } catch (Exception e) {
            log.error("Failed to get structured recommendation [caseId={}, error={}]",
                    resolutionCase.getId(), e.getMessage());
            return Optional.empty();
        }
    }

    private String resolveCurrentUserRole() {
        // In service-level calls (e.g. post-triage automatic analysis), role is SYSTEM.
        // The recommendation endpoint passes the real user role separately.
        return "SYSTEM";
    }
}

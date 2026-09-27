package com.zeno.api.resolution;

import com.zeno.api.refill.RefillRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.Optional;

/**
 * Stub implementation of ResolutionRecommendationService.
 * The real implementation will call the Python/LangGraph AI workflow service.
 *
 * This stub returns empty — the AI feature is NOT yet integrated.
 * Future implementation: POST to AI service, receive structured recommendation,
 * validate through deterministic rules, present to human for approval.
 */
@Service
public class StubResolutionRecommendationService implements ResolutionRecommendationService {

    private static final Logger log = LoggerFactory.getLogger(StubResolutionRecommendationService.class);

    @Override
    public Optional<String> getRecommendation(ResolutionCase resolutionCase, RefillRequest refillRequest) {
        log.debug("AI recommendation requested for case={} — AI service not yet integrated", resolutionCase.getId());
        return Optional.empty();
    }

    @Override
    public boolean isAvailable() {
        return false;
    }
}

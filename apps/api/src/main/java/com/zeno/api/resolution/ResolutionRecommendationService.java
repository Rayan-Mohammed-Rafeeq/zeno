package com.zeno.api.resolution;

import com.zeno.api.refill.RefillRequest;

import java.util.Optional;

/**
 * Integration point for the future AI Workflow Service (LangGraph).
 *
 * Architecture:
 *   Spring Boot → AI Workflow Service → LangGraph → tools/retrieval/reasoning
 *   → structured resolution recommendation → Spring Boot
 *   → deterministic validation → human approval → state update
 *
 * CRITICAL:
 * - The AI service can RECOMMEND actions but CANNOT directly mutate data.
 * - The backend is the source of truth.
 * - Authorized humans must approve consequential actions.
 * - This interface allows the LangGraph service to pause/resume workflows.
 */
public interface ResolutionRecommendationService {

    /**
     * Request an AI recommendation for how to resolve a blocker.
     * Returns the recommendation text, which must be reviewed by a human.
     */
    Optional<String> getRecommendation(ResolutionCase resolutionCase, RefillRequest refillRequest);

    /**
     * Check whether the AI service is available.
     */
    boolean isAvailable();
}

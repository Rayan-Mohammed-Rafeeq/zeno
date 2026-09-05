package com.zeno.modules.intelligence.application;

import com.zeno.modules.intelligence.domain.AiAssessmentEntity;
import com.zeno.modules.intelligence.domain.AssessmentType;

import java.util.List;

/**
 * Result from the AI intelligence provider.
 *
 * IMPORTANT: AI assessments are advisory only.
 * They never establish guilt and must not be the sole basis for action.
 * Confidence values are model estimates, not statistical certainties.
 *
 * structuredResult is populated when the LLM returns parseable JSON.
 * When null the deterministic fallback values (assessmentType, confidence,
 * reasons, recommendedAction) are the authoritative output.
 */
public record AiAssessment(
        AssessmentType assessmentType,
        double confidence,
        List<String> reasons,
        String recommendedAction,
        String provider,
        /** Full structured LLM result — null when AI unavailable or parse failed */
        AiAssessmentEntity.StructuredResult structuredResult
) {
    /** Convenience constructor for backwards-compatible fallback creation. */
    public static AiAssessment fallback(
            AssessmentType type,
            double confidence,
            List<String> reasons,
            String recommendedAction) {
        return new AiAssessment(type, confidence, reasons, recommendedAction, "rule-based-fallback", null);
    }
}

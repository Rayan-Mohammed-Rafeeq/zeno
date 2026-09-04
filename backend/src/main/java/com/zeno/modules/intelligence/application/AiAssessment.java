package com.zeno.modules.intelligence.application;

import com.zeno.modules.intelligence.domain.AssessmentType;

import java.util.List;

/**
 * Result from the AI intelligence provider.
 *
 * IMPORTANT: AI assessments are advisory only.
 * They never establish guilt and must not be the sole basis for action.
 * Confidence values are model estimates, not statistical certainties.
 */
public record AiAssessment(
        AssessmentType assessmentType,
        double confidence,
        List<String> reasons,
        String recommendedAction,
        String provider
) {}

package com.zeno.modules.intelligence.interfaces.dto;

import com.zeno.modules.intelligence.domain.AiAssessmentEntity;
import com.zeno.modules.intelligence.domain.AssessmentType;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Response DTO for an AI evidence assessment.
 *
 * structuredResult is the primary output when AI succeeded.
 * When null, the caller should use the flat assessmentType/confidence/reasons fields
 * which are always populated (deterministic fallback).
 *
 * disclaimer is always included and must be surfaced in the UI.
 */
public record AiAssessmentResponse(
        UUID id,
        UUID merchantId,
        String subjectType,
        UUID subjectId,
        AssessmentType assessmentType,
        double confidence,
        List<String> reasons,
        String recommendedAction,
        String provider,
        /** Full structured result — null when LLM failed, deterministic fallback used instead */
        AiAssessmentEntity.StructuredResult structuredResult,
        /** Advisory disclaimer — always included */
        String disclaimer,
        Instant createdAt
) {
    private static final String DISCLAIMER =
            "This assessment is advisory only. It is based on synthetic data and statistical signals. " +
            "It does not establish guilt and must be reviewed by a qualified analyst before any action is taken. " +
            "Confidence values are model estimates, not statistical certainties.";

    public static AiAssessmentResponse from(AiAssessmentEntity e) {
        return new AiAssessmentResponse(
                e.getId(), e.getMerchantId(), e.getSubjectType(), e.getSubjectId(),
                e.getAssessmentType(), e.getConfidence() != null ? e.getConfidence() : 0.0,
                e.getReasons(), e.getRecommendedAction(), e.getProvider(),
                e.getStructuredResult(),
                DISCLAIMER,
                e.getCreatedAt());
    }
}

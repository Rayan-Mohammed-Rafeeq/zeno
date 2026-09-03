package com.niro.modules.intelligence.interfaces.dto;

import com.niro.modules.intelligence.domain.AiAssessmentEntity;
import com.niro.modules.intelligence.domain.AssessmentType;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

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
                DISCLAIMER, e.getCreatedAt());
    }
}

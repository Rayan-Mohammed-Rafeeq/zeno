package com.zeno.modules.decision.interfaces.dto;

import com.zeno.modules.decision.domain.DecisionRecommendation;
import com.zeno.modules.decision.domain.DecisionType;
import com.zeno.modules.risk.domain.RiskLevel;

import java.time.Instant;
import java.util.UUID;

public record DecisionResponse(
        UUID id,
        UUID merchantId,
        String subjectType,
        UUID subjectId,
        RiskLevel riskLevel,
        int riskScore,
        DecisionType decision,
        String rationale,
        boolean overridden,
        String overrideReason,
        /** Defensive disclaimer — always included */
        String disclaimer,
        Instant createdAt
) {
    private static final String DISCLAIMER =
            "This is a defensive recommendation only. No action has been taken. " +
            "Recommendations do not establish guilt and must not be acted upon without analyst review. " +
            "False positives are possible — review all evidence before proceeding.";

    public static DecisionResponse from(DecisionRecommendation r) {
        return new DecisionResponse(
                r.getId(), r.getMerchantId(), r.getSubjectType(), r.getSubjectId(),
                r.getRiskLevel(), r.getRiskScore(), r.getDecision(), r.getRationale(),
                r.isOverridden(), r.getOverrideReason(), DISCLAIMER, r.getCreatedAt());
    }
}

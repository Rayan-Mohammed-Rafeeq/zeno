package com.zeno.modules.risk.interfaces.dto;

import com.zeno.modules.risk.domain.RiskAssessment;
import com.zeno.modules.risk.domain.RiskLevel;
import com.zeno.modules.risk.domain.RiskSignalEntity;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record RiskAssessmentResponse(
        UUID id,
        UUID merchantId,
        UUID customerId,
        int riskScore,
        RiskLevel riskLevel,
        boolean flagged,
        List<RiskSignalResponse> signals,

        // ML-augmented fields — null when ML service is disabled or unavailable
        Double fraudProbability,
        Double anomalyScore,
        String modelVersion,
        String featureVersion,

        Instant createdAt
) {
    public static RiskAssessmentResponse from(RiskAssessment a, List<RiskSignalEntity> signals) {
        return new RiskAssessmentResponse(
                a.getId(), a.getMerchantId(), a.getCustomerId(),
                a.getRiskScore(), a.getRiskLevel(), a.isFlagged(),
                signals.stream().map(RiskSignalResponse::from).toList(),
                a.getFraudProbability(),
                a.getAnomalyScore(),
                a.getModelVersion(),
                a.getFeatureVersion(),
                a.getCreatedAt());
    }
}

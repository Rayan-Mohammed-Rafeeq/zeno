package com.niro.modules.risk.interfaces.dto;

import com.niro.modules.risk.domain.RiskAssessment;
import com.niro.modules.risk.domain.RiskLevel;
import com.niro.modules.risk.domain.RiskSignalEntity;

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
        Instant createdAt
) {
    public static RiskAssessmentResponse from(RiskAssessment a, List<RiskSignalEntity> signals) {
        return new RiskAssessmentResponse(
                a.getId(), a.getMerchantId(), a.getCustomerId(),
                a.getRiskScore(), a.getRiskLevel(), a.isFlagged(),
                signals.stream().map(RiskSignalResponse::from).toList(),
                a.getCreatedAt());
    }
}

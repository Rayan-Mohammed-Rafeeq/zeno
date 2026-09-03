package com.niro.modules.intelligence.application;

import com.niro.modules.risk.domain.RiskLevel;
import com.niro.modules.risk.domain.SignalType;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * Structured evidence bundle assembled from observable signals.
 * Passed to the AI provider for interpretation — never includes ground truth.
 *
 * All values are computed from deterministic signals.
 * The AI interprets this evidence; it does NOT determine fraud.
 */
@Getter
@Builder
public class EvidenceBundle {
    private final UUID merchantId;
    private final String subjectType;
    private final UUID subjectId;

    private final int riskScore;
    private final RiskLevel riskLevel;
    private final List<SignalType> triggeredSignals;

    private final double refundRate;
    private final double merchantBaselineRefundRate;
    private final int transactionCount;
    private final int refundCount;

    private final int sharedDeviceCount;
    private final int sharedIpCount;
    private final int velocityLast24h;

    private final int clusterSize;
    private final BigDecimal estimatedExposure;

    /** Human-readable signal explanations for context */
    private final List<String> signalExplanations;
}

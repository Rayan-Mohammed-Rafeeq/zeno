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
 *
 * ML fields (fraudProbability, anomalyScore, shapContributions) are nullable —
 * they are populated when the ML service is enabled, and absent otherwise.
 * The LLM prompt must explicitly distinguish ML-derived quantities from
 * rule-based signals, and must not invent values for absent fields.
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

    // ── ML-augmented fields (nullable — populated when ML service is enabled) ──

    /** Calibrated XGBoost fraud probability [0,1]. Null when ML service disabled. */
    private final Double fraudProbability;

    /** Normalised Isolation Forest anomaly score [0,1]. Null when ML service disabled. */
    private final Double anomalyScore;

    /** ML model version string. Null when ML service disabled. */
    private final String modelVersion;

    /**
     * Top SHAP feature contributors from the ML explanation.
     * Each entry: "feature_name (+0.34)" or "feature_name (-0.12)"
     * Null or empty when ML service disabled.
     */
    private final List<String> shapContributions;
}

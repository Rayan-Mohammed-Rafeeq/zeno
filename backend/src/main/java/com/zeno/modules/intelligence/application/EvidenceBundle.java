package com.zeno.modules.intelligence.application;

import com.zeno.modules.risk.domain.RiskLevel;
import com.zeno.modules.risk.domain.SignalType;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * Structured evidence bundle assembled from observable signals.
 * Passed to the AI provider for interpretation — never includes ground truth.
 *
 * All values are computed from deterministic signals or ML model output.
 * The AI interprets this evidence; it does NOT determine fraud.
 *
 * ML fields (fraudProbability, anomalyScore, shapContributions) are nullable —
 * they are populated when the ML service is enabled, and absent otherwise.
 * The LLM prompt must explicitly distinguish ML-derived quantities from
 * rule-based signals, and must not invent values for absent fields.
 *
 * Graph/cluster fields are nullable — populated when graph analysis has run.
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

    /** Enriched signal entries with observed/baseline values */
    private final List<SignalDetail> signalDetails;

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

    // ── Graph/cluster fields (nullable — populated when cluster detection has run) ──

    /** Number of connected high-risk entity IDs in the same cluster */
    private final Integer connectedHighRiskCount;

    /** Brief description of how this subject connects to other cluster members */
    private final String clusterRelationshipSummary;

    // ── Benchmark metrics (always available for context) ──
    private final String benchmarkPrecision;
    private final String benchmarkRecall;
    private final String benchmarkAuprc;

    /**
     * Enriched signal detail carrying observed + baseline values.
     * Used to produce evidence-grounded LLM reasoning.
     */
    @Getter
    @Builder
    public static class SignalDetail {
        private final String signalName;
        private final String signalType;
        private final String severity;
        private final double observedValue;
        private final double baselineValue;
        private final int scoreContribution;
        private final String explanation;
    }
}

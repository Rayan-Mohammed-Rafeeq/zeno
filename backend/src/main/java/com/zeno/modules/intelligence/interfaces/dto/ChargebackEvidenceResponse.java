package com.zeno.modules.intelligence.interfaces.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Defensive chargeback/dispute evidence package.
 *
 * Organizes observable risk signals, transaction facts, ML evidence,
 * and network evidence into a structured merchant-facing summary.
 *
 * IMPORTANT: This is a defensive tool only.
 * All data is sourced from the Zeno risk database.
 * Analyst verification is required before use in any dispute process.
 */
public record ChargebackEvidenceResponse(
        UUID subjectId,
        String subjectType,

        /** High-level case summary */
        String caseSummary,

        /** Transaction facts */
        int totalTransactions,
        double totalAmountInr,
        int totalRefunds,
        double refundRate,
        double merchantBaselineRefundRate,

        /** Risk assessment */
        int riskScore,
        String riskLevel,
        List<String> triggeredSignals,

        /** ML evidence */
        Double fraudProbability,
        String modelVersion,
        List<String> topShapDrivers,

        /** Network evidence */
        int clusterSize,
        String networkSummary,

        /** Recommended defensive action */
        String recommendedAction,

        /** Timeline */
        Instant evidenceGeneratedAt,

        /** Limitations — always included */
        List<String> limitations,

        /** AI disclaimer — always included */
        String disclaimer
) {
    private static final List<String> STANDARD_LIMITATIONS = List.of(
            "AI-generated evidence summary. Requires analyst verification before use in any dispute process.",
            "Risk signals are based on statistical patterns — they indicate elevated risk, not confirmed fraud.",
            "ML fraud probability is a model estimate trained on IEEE-CIS benchmark data, not Razorpay production data.",
            "SHAP values explain model predictions, not ground truth.",
            "This evidence package does not independently establish fraud or constitute legal proof."
    );

    private static final String DISCLAIMER =
            "AI-generated evidence summary. Requires analyst verification. " +
            "Does not independently establish fraud. " +
            "Analyst review is required before any action is taken.";

    public static ChargebackEvidenceResponse of(
            UUID subjectId, String subjectType, String caseSummary,
            int totalTransactions, double totalAmountInr, int totalRefunds,
            double refundRate, double merchantBaselineRefundRate,
            int riskScore, String riskLevel, List<String> triggeredSignals,
            Double fraudProbability, String modelVersion, List<String> topShapDrivers,
            int clusterSize, String networkSummary, String recommendedAction
    ) {
        return new ChargebackEvidenceResponse(
                subjectId, subjectType, caseSummary,
                totalTransactions, totalAmountInr, totalRefunds,
                refundRate, merchantBaselineRefundRate,
                riskScore, riskLevel, triggeredSignals,
                fraudProbability, modelVersion, topShapDrivers,
                clusterSize, networkSummary, recommendedAction,
                Instant.now(),
                STANDARD_LIMITATIONS,
                DISCLAIMER
        );
    }
}

package com.zeno.modules.evaluation.interfaces.dto;

import com.zeno.config.ZenoProperties;
import com.zeno.modules.evaluation.domain.EvaluationRun;

import java.time.Instant;
import java.util.UUID;

public record EvaluationRunResponse(
        UUID id,
        UUID merchantId,
        UUID datasetRunId,
        Instant evaluatedAt,
        int sampleCount,
        int truePositive,
        int trueNegative,
        int falsePositive,
        int falseNegative,
        double precision,
        double recall,
        double f1,
        double falsePositiveRate,
        double falseNegativeRate,
        double falsePositiveCost,
        CostAssumptions costAssumptions,
        /** Mandatory disclaimer about prototype metric assumptions */
        String disclaimer,
        Instant createdAt
) {
    private static final String DISCLAIMER =
            "Metrics are computed from synthetic data and a prototype risk detector. " +
            "They do not represent production fraud detection performance. " +
            "False positive cost values are model assumptions documented in costAssumptions — " +
            "they are not real merchant losses.";

    public record CostAssumptions(double manualReviewCostUsd, double heldTransactionOpportunityCostUsd) {}

    public static EvaluationRunResponse from(EvaluationRun r, ZenoProperties.Evaluation.FalsePositiveCost costs) {
        return new EvaluationRunResponse(
                r.getId(), r.getMerchantId(), r.getDatasetRunId(), r.getEvaluatedAt(),
                r.getSampleCount(), r.getTruePositive(), r.getTrueNegative(),
                r.getFalsePositive(), r.getFalseNegative(),
                nvl(r.getPrecisionScore()), nvl(r.getRecallScore()), nvl(r.getF1Score()),
                nvl(r.getFalsePositiveRate()), nvl(r.getFalseNegativeRate()),
                nvl(r.getFalsePositiveCost()),
                new CostAssumptions(costs.getManualReviewCost(), costs.getHeldTransactionOpportunityCost()),
                DISCLAIMER, r.getCreatedAt());
    }

    private static double nvl(Double v) {
        return v != null ? v : 0.0;
    }
}

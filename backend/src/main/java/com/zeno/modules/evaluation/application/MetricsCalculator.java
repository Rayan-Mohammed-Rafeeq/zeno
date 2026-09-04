package com.zeno.modules.evaluation.application;

import org.springframework.stereotype.Component;

/**
 * Computes precision, recall, F1, FPR, FNR from a ConfusionMatrix.
 * All arithmetic is deterministic — no randomness, no LLM involvement.
 */
@Component
public class MetricsCalculator {

    public EvaluationMetrics compute(ConfusionMatrix cm) {
        double precision = cm.predictedPositive() > 0
                ? (double) cm.truePositive() / cm.predictedPositive()
                : 0.0;

        double recall = cm.actualPositive() > 0
                ? (double) cm.truePositive() / cm.actualPositive()
                : 0.0;

        double f1 = (precision + recall) > 0
                ? 2.0 * precision * recall / (precision + recall)
                : 0.0;

        double falsePositiveRate = cm.actualNegative() > 0
                ? (double) cm.falsePositive() / cm.actualNegative()
                : 0.0;

        double falseNegativeRate = cm.actualPositive() > 0
                ? (double) cm.falseNegative() / cm.actualPositive()
                : 0.0;

        return new EvaluationMetrics(
                round(precision),
                round(recall),
                round(f1),
                round(falsePositiveRate),
                round(falseNegativeRate)
        );
    }

    private double round(double value) {
        return Math.round(value * 10000.0) / 10000.0;
    }
}

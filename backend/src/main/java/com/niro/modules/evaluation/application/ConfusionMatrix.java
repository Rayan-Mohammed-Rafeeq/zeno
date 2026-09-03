package com.niro.modules.evaluation.application;

/**
 * Raw confusion matrix counts computed from detector predictions vs ground truth.
 */
public record ConfusionMatrix(
        int truePositive,
        int trueNegative,
        int falsePositive,
        int falseNegative
) {
    public int total() {
        return truePositive + trueNegative + falsePositive + falseNegative;
    }

    public int predictedPositive() {
        return truePositive + falsePositive;
    }

    public int actualPositive() {
        return truePositive + falseNegative;
    }

    public int actualNegative() {
        return trueNegative + falsePositive;
    }
}

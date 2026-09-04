package com.zeno.modules.evaluation.interfaces.dto;

/**
 * Per-signal precision, recall, FP count and percentage contribution.
 * Used by the frontend Evaluation page radar chart and signal table.
 *
 * All values are MODEL ESTIMATES derived from synthetic ground truth.
 */
public record SignalPerformanceResponse(
        String signalType,
        double precision,
        double recall,
        int falsePositives,
        double contribution    // percentage contribution to total FP count (0–100)
) {}

package com.zeno.modules.evaluation.interfaces.dto;

import java.util.UUID;

/**
 * A single false-positive example for the error analysis table.
 * Represents a customer who was predicted HIGH/CRITICAL but is actually LEGITIMATE
 * according to the hidden ground truth labels.
 */
public record FalsePositiveCaseResponse(
        String id,
        String customerId,
        String customerName,
        int riskScore,
        String predictedRisk,
        String actualLabel,    // always "LEGITIMATE"
        String reason          // human-readable explanation of why the detector flagged this customer
) {}

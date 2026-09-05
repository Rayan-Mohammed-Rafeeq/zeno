package com.zeno.modules.intelligence.interfaces.dto;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

/**
 * Request to generate a defensive chargeback/dispute evidence package.
 *
 * This organizes existing observable evidence into a merchant-facing summary.
 * The AI may summarize and structure the evidence, but must never invent facts.
 * All output is labeled as AI-generated and requires analyst verification.
 */
public record ChargebackEvidenceRequest(
        @NotNull(message = "subjectId is required") UUID subjectId,
        /** "CUSTOMER" — the only supported type for chargeback evidence */
        String subjectType
) {}

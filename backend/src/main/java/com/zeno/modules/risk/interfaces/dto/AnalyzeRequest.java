package com.zeno.modules.risk.interfaces.dto;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record AnalyzeRequest(
        /** Analyze a specific customer. If null, analyzes all customers for the merchant. */
        UUID customerId
) {}

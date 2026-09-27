package com.zeno.api.resolution;

import java.time.LocalDate;

public record ResolveCaseRequest(
        String resolutionSummary,
        LocalDate newExpiryDate,
        Integer newRefillsAllowed,
        String newRxNumber
) {}

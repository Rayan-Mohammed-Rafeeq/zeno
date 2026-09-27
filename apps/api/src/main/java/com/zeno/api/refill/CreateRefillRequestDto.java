package com.zeno.api.refill;

public record CreateRefillRequestDto(
        Long prescriptionId,
        Long pharmacyId,
        RefillPriority priority,
        String notes
) {}

package com.zeno.api.refill;

/**
 * Command object for creating a new refill request.
 */
public record CreateRefillRequestCommand(
        Long prescriptionId,
        Long pharmacyId,
        Long requestedByUserId,
        RefillPriority priority,
        String notes
) {}

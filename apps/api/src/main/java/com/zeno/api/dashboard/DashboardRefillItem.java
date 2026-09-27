package com.zeno.api.dashboard;

import com.zeno.api.refill.BlockerType;
import com.zeno.api.refill.RefillPriority;
import com.zeno.api.refill.RefillRequest;
import com.zeno.api.refill.RefillStatus;

import java.time.LocalDateTime;

/**
 * Flattened view of a refill request for the dashboard queue.
 * Answers: "Why is this stuck? Who has it? How urgent?"
 */
public record DashboardRefillItem(
        Long refillId,
        String patientName,
        String medicationName,
        BlockerType blocker,
        RefillStatus status,
        RefillPriority priority,
        LocalDateTime waitingSince,
        String pharmacyName,
        String providerName
) {
    public static DashboardRefillItem from(RefillRequest r) {
        return new DashboardRefillItem(
                r.getId(),
                r.getPatient() != null ? r.getPatient().getFullName() : "Unknown",
                r.getPrescription() != null ? r.getPrescription().getMedicationName() : "Unknown",
                r.getBlockerType(),
                r.getStatus(),
                r.getPriority(),
                r.getCreatedAt(),
                r.getPharmacy() != null ? r.getPharmacy().getName() : "Unknown",
                r.getPrescription() != null && r.getPrescription().getProvider() != null
                        ? r.getPrescription().getProvider().getFullName() : "Unknown"
        );
    }
}

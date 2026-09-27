package com.zeno.api.refill;

import com.zeno.api.patient.Patient;
import com.zeno.api.pharmacy.Pharmacy;
import com.zeno.api.prescription.Prescription;
import com.zeno.api.provider.Provider;
import com.zeno.api.user.User;
import com.zeno.api.user.UserRole;

import java.time.LocalDateTime;

/** Safe, bounded API representation of a refill request. */
public record RefillRequestResponse(
        Long id,
        PatientSummary patient,
        PrescriptionSummary prescription,
        PharmacySummary pharmacy,
        UserSummary requestedBy,
        RefillStatus status,
        BlockerType blockerType,
        RefillPriority priority,
        String notes,
        LocalDateTime resolvedAt,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public static RefillRequestResponse from(RefillRequest refill) {
        return new RefillRequestResponse(
                refill.getId(),
                PatientSummary.from(refill.getPatient()),
                PrescriptionSummary.from(refill.getPrescription()),
                PharmacySummary.from(refill.getPharmacy()),
                UserSummary.from(refill.getRequestedBy()),
                refill.getStatus(),
                refill.getBlockerType(),
                refill.getPriority(),
                refill.getNotes(),
                refill.getResolvedAt(),
                refill.getCreatedAt(),
                refill.getUpdatedAt()
        );
    }

    public record PatientSummary(Long id, String firstName, String lastName, String mrn) {
        private static PatientSummary from(Patient patient) {
            return patient == null ? null : new PatientSummary(
                    patient.getId(), patient.getFirstName(), patient.getLastName(), patient.getMrn());
        }
    }

    public record PrescriptionSummary(
            Long id,
            String medicationName,
            String medicationStrength,
            String instructions,
            Integer quantityDispensed,
            Integer daysSupply,
            Integer refillsAllowed,
            Integer refillsUsed,
            String rxNumber,
            ProviderSummary provider
    ) {
        private static PrescriptionSummary from(Prescription prescription) {
            return prescription == null ? null : new PrescriptionSummary(
                    prescription.getId(), prescription.getMedicationName(), prescription.getMedicationStrength(),
                    prescription.getInstructions(), prescription.getQuantityDispensed(), prescription.getDaysSupply(),
                    prescription.getRefillsAllowed(), prescription.getRefillsUsed(), prescription.getRxNumber(),
                    ProviderSummary.from(prescription.getProvider()));
        }
    }

    public record ProviderSummary(Long id, String firstName, String lastName, String npi, String specialty) {
        private static ProviderSummary from(Provider provider) {
            return provider == null ? null : new ProviderSummary(
                    provider.getId(), provider.getFirstName(), provider.getLastName(), provider.getNpi(),
                    provider.getSpecialty());
        }
    }

    public record UserSummary(Long id, String username, String firstName, String lastName, UserRole role) {
        private static UserSummary from(User user) {
            return user == null ? null : new UserSummary(
                    user.getId(), user.getUsername(), user.getFirstName(), user.getLastName(), user.getRole());
        }
    }

    public record PharmacySummary(Long id, String name) {
        private static PharmacySummary from(Pharmacy pharmacy) {
            return pharmacy == null ? null : new PharmacySummary(pharmacy.getId(), pharmacy.getName());
        }
    }
}

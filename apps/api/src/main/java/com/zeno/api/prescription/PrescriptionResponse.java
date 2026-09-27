package com.zeno.api.prescription;

import com.zeno.api.patient.Patient;
import com.zeno.api.pharmacy.Pharmacy;
import com.zeno.api.provider.Provider;

import java.time.LocalDate;
import java.time.LocalDateTime;

/** Safe API representation of a prescription without serializing JPA relationships. */
public record PrescriptionResponse(
        Long id,
        PatientSummary patient,
        ProviderSummary provider,
        PharmacySummary pharmacy,
        String medicationName,
        String medicationStrength,
        String dosageForm,
        String instructions,
        Integer quantityDispensed,
        Integer daysSupply,
        Integer refillsAllowed,
        Integer refillsUsed,
        LocalDate writtenDate,
        LocalDate expiryDate,
        PrescriptionStatus status,
        String deaSchedule,
        String rxNumber,
        boolean requiresPriorAuth,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public static PrescriptionResponse from(Prescription prescription) {
        return new PrescriptionResponse(
                prescription.getId(),
                PatientSummary.from(prescription.getPatient()),
                ProviderSummary.from(prescription.getProvider()),
                PharmacySummary.from(prescription.getPharmacy()),
                prescription.getMedicationName(),
                prescription.getMedicationStrength(),
                prescription.getDosageForm(),
                prescription.getInstructions(),
                prescription.getQuantityDispensed(),
                prescription.getDaysSupply(),
                prescription.getRefillsAllowed(),
                prescription.getRefillsUsed(),
                prescription.getWrittenDate(),
                prescription.getExpiryDate(),
                prescription.getStatus(),
                prescription.getDeaSchedule(),
                prescription.getRxNumber(),
                prescription.isRequiresPriorAuth(),
                prescription.getCreatedAt(),
                prescription.getUpdatedAt()
        );
    }

    public record PatientSummary(
            Long id,
            String firstName,
            String lastName,
            LocalDate dateOfBirth,
            String email,
            String phoneNumber,
            String mrn
    ) {
        private static PatientSummary from(Patient patient) {
            return patient == null ? null : new PatientSummary(
                    patient.getId(), patient.getFirstName(), patient.getLastName(), patient.getDateOfBirth(),
                    patient.getEmail(), patient.getPhoneNumber(), patient.getMrn());
        }
    }

    public record ProviderSummary(
            Long id,
            String firstName,
            String lastName,
            String npi,
            String specialty,
            String email,
            String phoneNumber,
            Provider.ProviderStatus status,
            String fullName
    ) {
        private static ProviderSummary from(Provider provider) {
            return provider == null ? null : new ProviderSummary(
                    provider.getId(), provider.getFirstName(), provider.getLastName(), provider.getNpi(),
                    provider.getSpecialty(), provider.getEmail(), provider.getPhoneNumber(),
                    provider.getStatus(), provider.getFullName());
        }
    }

    public record PharmacySummary(
            Long id,
            String name,
            String ncpdpId,
            String address,
            String phone,
            Pharmacy.PharmacyStatus status
    ) {
        private static PharmacySummary from(Pharmacy pharmacy) {
            return pharmacy == null ? null : new PharmacySummary(
                    pharmacy.getId(), pharmacy.getName(), pharmacy.getNcpdpId(), pharmacy.getAddress(),
                    pharmacy.getPhone(), pharmacy.getStatus());
        }
    }
}

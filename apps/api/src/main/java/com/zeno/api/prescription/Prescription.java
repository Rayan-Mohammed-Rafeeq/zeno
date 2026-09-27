package com.zeno.api.prescription;

import com.zeno.api.patient.Patient;
import com.zeno.api.provider.Provider;
import com.zeno.api.pharmacy.Pharmacy;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Represents an existing prescription.
 * This is the source record that refill requests are based upon.
 */
@Entity
@Table(name = "prescriptions",
        indexes = {
                @Index(name = "idx_prescription_patient", columnList = "patient_id"),
                @Index(name = "idx_prescription_provider", columnList = "provider_id"),
                @Index(name = "idx_prescription_status", columnList = "status")
        })
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Prescription {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "patient_id", nullable = false)
    private Patient patient;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "provider_id", nullable = false)
    private Provider provider;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pharmacy_id")
    private Pharmacy pharmacy;

    @Column(name = "medication_name", nullable = false)
    private String medicationName;

    @Column(name = "medication_strength")
    private String medicationStrength;

    @Column(name = "dosage_form")
    private String dosageForm;

    private String instructions;

    @Column(name = "quantity_dispensed")
    private Integer quantityDispensed;

    @Column(name = "days_supply")
    private Integer daysSupply;

    @Column(name = "refills_allowed", nullable = false)
    @Builder.Default
    private Integer refillsAllowed = 0;

    @Column(name = "refills_used", nullable = false)
    @Builder.Default
    private Integer refillsUsed = 0;

    @Column(name = "written_date")
    private LocalDate writtenDate;

    @Column(name = "expiry_date")
    private LocalDate expiryDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private PrescriptionStatus status = PrescriptionStatus.ACTIVE;

    /** DEA Schedule for controlled substances (I-V or blank for non-controlled) */
    @Column(name = "dea_schedule")
    private String deaSchedule;

    /** External RX number from pharmacy system */
    @Column(name = "rx_number")
    private String rxNumber;

    @Column(name = "requires_prior_auth")
    @Builder.Default
    private boolean requiresPriorAuth = false;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    /** Business method: how many refills remain */
    public int refillsRemaining() {
        return Math.max(0, refillsAllowed - refillsUsed);
    }

    /** Business method: is the prescription expired */
    public boolean isExpired() {
        return expiryDate != null && expiryDate.isBefore(LocalDate.now());
    }

    /** Business method: has this prescription run out of refills */
    public boolean isOutOfRefills() {
        return refillsUsed >= refillsAllowed;
    }
}

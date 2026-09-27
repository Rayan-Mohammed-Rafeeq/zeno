package com.zeno.api.refill;

import com.zeno.api.patient.Patient;
import com.zeno.api.pharmacy.Pharmacy;
import com.zeno.api.prescription.Prescription;
import com.zeno.api.user.User;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * A RefillRequest represents a request to fill an existing prescription.
 * This is the central entity of the Zeno workflow — every refill goes through
 * a lifecycle from REQUESTED → (triage) → [various states] → COMPLETED or ESCALATED.
 *
 * Key questions this entity must answer:
 * - What is the current state?
 * - Why is it blocked? (blockerType)
 * - Who owns this right now? (requestedBy, assignedTo)
 * - How urgent is it? (priority)
 */
@Entity
@Table(name = "refill_requests",
        indexes = {
                @Index(name = "idx_refill_status", columnList = "status"),
                @Index(name = "idx_refill_prescription", columnList = "prescription_id"),
                @Index(name = "idx_refill_patient", columnList = "patient_id"),
                @Index(name = "idx_refill_pharmacy", columnList = "pharmacy_id"),
                @Index(name = "idx_refill_blocker", columnList = "blocker_type"),
                @Index(name = "idx_refill_priority", columnList = "priority"),
                @Index(name = "idx_refill_created_at", columnList = "created_at")
        })
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RefillRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "prescription_id", nullable = false)
    private Prescription prescription;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "patient_id", nullable = false)
    private Patient patient;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pharmacy_id", nullable = false)
    private Pharmacy pharmacy;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "requested_by_user_id")
    private User requestedBy;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    @Builder.Default
    private RefillStatus status = RefillStatus.REQUESTED;

    @Enumerated(EnumType.STRING)
    @Column(name = "blocker_type")
    private BlockerType blockerType;

    @Enumerated(EnumType.STRING)
    @Column(name = "priority", nullable = false)
    @Builder.Default
    private RefillPriority priority = RefillPriority.NORMAL;

    /** Free-text notes from the requesting party */
    private String notes;

    /** Timestamp when the refill was resolved */
    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}

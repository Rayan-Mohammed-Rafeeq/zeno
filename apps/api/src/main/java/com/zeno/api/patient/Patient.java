package com.zeno.api.patient;

import com.zeno.api.organization.Organization;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Represents a patient in the context of prescriptions and refill requests.
 * Contains only the minimum data needed for workflow operations.
 * Not an EMR — do not extend with clinical data.
 */
@Entity
@Table(name = "patients",
        indexes = {
                @Index(name = "idx_patient_org", columnList = "organization_id"),
                @Index(name = "idx_patient_mrn", columnList = "mrn")
        })
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Patient {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "first_name", nullable = false)
    private String firstName;

    @Column(name = "last_name", nullable = false)
    private String lastName;

    @Column(name = "date_of_birth")
    private LocalDate dateOfBirth;

    @Column(unique = true)
    private String email;

    @Column(name = "phone_number")
    private String phoneNumber;

    /** Medical Record Number — facility-specific identifier */
    @Column(name = "mrn")
    private String mrn;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organization_id")
    private Organization organization;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public String getFullName() {
        return firstName + " " + lastName;
    }
}

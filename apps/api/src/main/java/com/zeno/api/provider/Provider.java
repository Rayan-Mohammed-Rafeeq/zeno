package com.zeno.api.provider;

import com.zeno.api.organization.Organization;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Represents an authorized healthcare provider (MD, DO, NP, PA, etc.)
 * associated with prescriptions.
 *
 * IMPORTANT: The system must NOT make clinical prescribing decisions.
 * Providers remain responsible for all clinical approval and prescribing.
 */
@Entity
@Table(name = "providers",
        indexes = {
                @Index(name = "idx_provider_org", columnList = "organization_id"),
                @Index(name = "idx_provider_npi", columnList = "npi")
        })
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Provider {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "first_name", nullable = false)
    private String firstName;

    @Column(name = "last_name", nullable = false)
    private String lastName;

    /** National Provider Identifier */
    @Column(name = "npi", unique = true)
    private String npi;

    private String specialty;
    private String email;

    @Column(name = "phone_number")
    private String phoneNumber;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private ProviderStatus status = ProviderStatus.ACTIVE;

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
        return "Dr. " + firstName + " " + lastName;
    }

    public enum ProviderStatus {
        ACTIVE, INACTIVE, ON_LEAVE
    }
}

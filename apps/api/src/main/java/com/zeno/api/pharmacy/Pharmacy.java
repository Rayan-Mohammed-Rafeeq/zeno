package com.zeno.api.pharmacy;

import com.zeno.api.organization.Organization;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * Represents a pharmacy location / entity involved in refill workflows.
 */
@Entity
@Table(name = "pharmacies",
        indexes = {
                @Index(name = "idx_pharmacy_org", columnList = "organization_id"),
                @Index(name = "idx_pharmacy_ncpdp", columnList = "ncpdp_id")
        })
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Pharmacy {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    /** NCPDP Pharmacy ID — standard pharmacy identifier */
    @Column(name = "ncpdp_id", unique = true)
    private String ncpdpId;

    private String address;
    private String phone;
    private String fax;
    private String email;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private PharmacyStatus status = PharmacyStatus.ACTIVE;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organization_id")
    private Organization organization;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    public enum PharmacyStatus {
        ACTIVE, INACTIVE
    }
}

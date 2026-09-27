package com.zeno.api.resolution;

import com.zeno.api.refill.BlockerType;
import com.zeno.api.refill.RefillPriority;
import com.zeno.api.refill.RefillRequest;
import com.zeno.api.user.User;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * A ResolutionCase is created when a RefillRequest is blocked.
 * It coordinates the actions needed to resolve the blocker.
 *
 * Separating ResolutionCase from RefillRequest allows:
 * - Clean tracking of who is responsible for resolution
 * - Multiple resolution attempts per refill
 * - AI recommendation integration without polluting the core refill record
 */
@Entity
@Table(name = "resolution_cases",
        indexes = {
                @Index(name = "idx_resolution_status", columnList = "status"),
                @Index(name = "idx_resolution_refill", columnList = "refill_request_id"),
                @Index(name = "idx_resolution_blocker", columnList = "blocker_type"),
                @Index(name = "idx_resolution_assigned", columnList = "assigned_to_user_id"),
                @Index(name = "idx_resolution_priority", columnList = "priority")
        })
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ResolutionCase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "refill_request_id", nullable = false, unique = true)
    private RefillRequest refillRequest;

    @Enumerated(EnumType.STRING)
    @Column(name = "blocker_type", nullable = false)
    private BlockerType blockerType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private ResolutionStatus status = ResolutionStatus.OPEN;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private RefillPriority priority = RefillPriority.NORMAL;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_to_user_id")
    private User assignedTo;

    /** Human-readable explanation of the blocker */
    @Column(columnDefinition = "TEXT")
    private String reason;

    /** Summary of what was done to resolve the case */
    @Column(name = "resolution_summary", columnDefinition = "TEXT")
    private String resolutionSummary;

    /**
     * AI-recommended action — set by ResolutionRecommendationService.
     * Humans must review and approve before any state changes occur.
     */
    @Column(name = "ai_recommendation", columnDefinition = "TEXT")
    private String aiRecommendation;

    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}

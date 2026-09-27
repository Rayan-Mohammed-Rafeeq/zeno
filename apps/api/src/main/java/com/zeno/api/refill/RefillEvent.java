package com.zeno.api.refill;

import com.zeno.api.user.User;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * Immutable append-only event log for the refill workflow.
 * Every meaningful state transition and action is recorded here.
 *
 * Answers: "What happened? Who did it? When? Why?"
 * This is critical for transparency and debugging stuck refills.
 */
@Entity
@Table(name = "refill_events",
        indexes = {
                @Index(name = "idx_event_refill", columnList = "refill_request_id"),
                @Index(name = "idx_event_type", columnList = "event_type"),
                @Index(name = "idx_event_created_at", columnList = "created_at")
        })
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RefillEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "refill_request_id", nullable = false)
    private RefillRequest refillRequest;

    @Enumerated(EnumType.STRING)
    @Column(name = "event_type", nullable = false)
    private RefillEventType eventType;

    /** Human-readable description of what happened */
    @Column(columnDefinition = "TEXT")
    private String description;

    /** The previous status (for state transition events) */
    @Enumerated(EnumType.STRING)
    @Column(name = "from_status")
    private RefillStatus fromStatus;

    /** The new status after the transition */
    @Enumerated(EnumType.STRING)
    @Column(name = "to_status")
    private RefillStatus toStatus;

    /** Who triggered this event (null = system) */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "actor_user_id")
    private User actor;

    /** System-generated context (e.g. "triage-engine", "ai-recommender") */
    @Column(name = "actor_label")
    private String actorLabel;

    /** Optional reference to related resolution case or action */
    @Column(name = "related_case_id")
    private Long relatedCaseId;

    @Column(name = "related_action_id")
    private Long relatedActionId;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}

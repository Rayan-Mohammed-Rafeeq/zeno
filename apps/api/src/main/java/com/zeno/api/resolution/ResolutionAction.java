package com.zeno.api.resolution;

import com.zeno.api.user.User;
import com.zeno.api.user.UserRole;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * A specific action that must be performed to advance a ResolutionCase.
 * Actions are assigned to roles or specific users.
 *
 * This is the human-in-the-loop mechanism: AI can recommend actions,
 * but humans must create, assign, and complete them.
 */
@Entity
@Table(name = "resolution_actions",
        indexes = {
                @Index(name = "idx_action_case", columnList = "resolution_case_id"),
                @Index(name = "idx_action_status", columnList = "status"),
                @Index(name = "idx_action_assigned_user", columnList = "assigned_user_id"),
                @Index(name = "idx_action_due_at", columnList = "due_at")
        })
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ResolutionAction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "resolution_case_id", nullable = false)
    private ResolutionCase resolutionCase;

    @Enumerated(EnumType.STRING)
    @Column(name = "action_type", nullable = false)
    private ActionType actionType;

    /** Role that should perform this action (broad assignment) */
    @Enumerated(EnumType.STRING)
    @Column(name = "assigned_role")
    private UserRole assignedRole;

    /** Specific user assigned to this action (optional) */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_user_id")
    private User assignedUser;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private ActionStatus status = ActionStatus.PENDING;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "completion_notes", columnDefinition = "TEXT")
    private String completionNotes;

    @Column(name = "due_at")
    private LocalDateTime dueAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "completed_by_user_id")
    private User completedBy;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}

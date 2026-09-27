package com.zeno.api.resolution;

import com.zeno.api.user.User;
import com.zeno.api.user.UserRole;

import java.time.LocalDateTime;

/** Safe API representation of an action with named assignees and no user credentials. */
public record ResolutionActionResponse(
        Long id,
        ActionType actionType,
        UserRole assignedRole,
        UserSummary assignedUser,
        ActionStatus status,
        String description,
        String completionNotes,
        LocalDateTime dueAt,
        LocalDateTime completedAt,
        UserSummary completedBy,
        LocalDateTime createdAt
) {
    public static ResolutionActionResponse from(ResolutionAction action) {
        return new ResolutionActionResponse(
                action.getId(), action.getActionType(), action.getAssignedRole(),
                UserSummary.from(action.getAssignedUser()), action.getStatus(), action.getDescription(),
                action.getCompletionNotes(), action.getDueAt(), action.getCompletedAt(),
                UserSummary.from(action.getCompletedBy()), action.getCreatedAt());
    }

    public record UserSummary(Long id, String username, String firstName, String lastName, UserRole role) {
        private static UserSummary from(User user) {
            return user == null ? null : new UserSummary(
                    user.getId(), user.getUsername(), user.getFirstName(), user.getLastName(), user.getRole());
        }
    }
}

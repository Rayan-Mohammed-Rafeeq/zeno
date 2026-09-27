package com.zeno.api.resolution;

import com.zeno.api.refill.BlockerType;
import com.zeno.api.refill.RefillPriority;
import com.zeno.api.refill.RefillRequestResponse;
import com.zeno.api.user.User;
import com.zeno.api.user.UserRole;

import java.time.LocalDateTime;

/** Safe, bounded API representation of a resolution case. */
public record ResolutionCaseResponse(
        Long id,
        RefillRequestResponse refillRequest,
        BlockerType blockerType,
        ResolutionStatus status,
        RefillPriority priority,
        UserSummary assignedTo,
        String reason,
        String resolutionSummary,
        String aiRecommendation,
        LocalDateTime resolvedAt,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
    public static ResolutionCaseResponse from(ResolutionCase rc) {
        if (rc == null) return null;
        return new ResolutionCaseResponse(
                rc.getId(),
                rc.getRefillRequest() != null ? RefillRequestResponse.from(rc.getRefillRequest()) : null,
                rc.getBlockerType(),
                rc.getStatus(),
                rc.getPriority(),
                UserSummary.from(rc.getAssignedTo()),
                rc.getReason(),
                rc.getResolutionSummary(),
                rc.getAiRecommendation(),
                rc.getResolvedAt(),
                rc.getCreatedAt(),
                rc.getUpdatedAt()
        );
    }

    public record UserSummary(Long id, String username, String firstName, String lastName, UserRole role) {
        private static UserSummary from(User user) {
            return user == null ? null : new UserSummary(
                    user.getId(), user.getUsername(), user.getFirstName(), user.getLastName(), user.getRole());
        }
    }
}

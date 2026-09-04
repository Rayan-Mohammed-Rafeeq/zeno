package com.zeno.modules.identity.interfaces.dto;

import com.zeno.modules.identity.domain.User;
import com.zeno.modules.identity.domain.UserRole;
import com.zeno.modules.identity.domain.UserStatus;

import java.time.Instant;
import java.util.UUID;

public record UserResponse(
        UUID id,
        String name,
        String email,
        UserRole role,
        boolean emailVerified,
        UserStatus status,
        Instant createdAt
) {
    public static UserResponse from(User user) {
        return new UserResponse(
                user.getId(),
                user.getName(),
                user.getEmail(),
                user.getRole(),
                user.isEmailVerified(),
                user.getStatus(),
                user.getCreatedAt()
        );
    }
}

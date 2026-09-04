package com.zeno.modules.admin.interfaces.dto;

import com.zeno.modules.identity.domain.User;
import com.zeno.modules.identity.domain.UserRole;
import com.zeno.modules.identity.domain.UserStatus;

import java.time.Instant;
import java.util.UUID;

public record AdminUserResponse(
        UUID id,
        String name,
        String email,
        UserRole role,
        UserStatus status,
        boolean emailVerified,
        Instant createdAt
) {
    public static AdminUserResponse from(User user) {
        return new AdminUserResponse(
                user.getId(),
                user.getName(),
                user.getEmail(),
                user.getRole(),
                user.getStatus(),
                user.isEmailVerified(),
                user.getCreatedAt()
        );
    }
}

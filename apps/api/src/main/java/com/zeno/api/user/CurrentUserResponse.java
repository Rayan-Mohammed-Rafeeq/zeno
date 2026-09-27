package com.zeno.api.user;

import java.time.LocalDateTime;

/** Safe authenticated-user view; never serializes the stored password hash. */
public record CurrentUserResponse(
        Long id,
        String username,
        String email,
        String name,
        String role,
        String roleDisplayName,
        Long organizationId,
        boolean active,
        LocalDateTime createdAt
) {}

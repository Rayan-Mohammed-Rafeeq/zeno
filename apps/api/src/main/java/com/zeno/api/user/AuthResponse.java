package com.zeno.api.user;

public record AuthResponse(
        String token,
        String role,
        String roleDisplayName,
        Long organizationId,
        String username,
        String firstName,
        String lastName
) {}

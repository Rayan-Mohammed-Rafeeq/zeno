package com.zeno.api.user;

public record RegisterRequest(
        String username,
        String password,
        String role,
        String firstName,
        String lastName,
        String email,
        Long organizationId
) {}

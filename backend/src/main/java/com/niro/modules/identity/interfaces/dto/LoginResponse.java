package com.niro.modules.identity.interfaces.dto;

import com.niro.modules.identity.domain.UserRole;

import java.util.UUID;

public record LoginResponse(String accessToken, UUID userId, String email, String name, UserRole role) {}


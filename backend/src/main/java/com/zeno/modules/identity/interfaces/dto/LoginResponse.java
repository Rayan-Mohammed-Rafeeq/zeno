package com.zeno.modules.identity.interfaces.dto;

import com.zeno.modules.identity.domain.UserRole;

import java.util.UUID;

public record LoginResponse(String accessToken, UUID userId, String email, String name, UserRole role) {}


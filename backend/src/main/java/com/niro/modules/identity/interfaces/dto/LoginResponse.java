package com.niro.modules.identity.interfaces.dto;

import java.util.UUID;

public record LoginResponse(String accessToken, UUID userId, String email, String name) {}

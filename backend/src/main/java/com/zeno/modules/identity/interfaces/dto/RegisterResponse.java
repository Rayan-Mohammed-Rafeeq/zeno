package com.zeno.modules.identity.interfaces.dto;

import java.util.UUID;

public record RegisterResponse(UUID userId, String email, String message) {}

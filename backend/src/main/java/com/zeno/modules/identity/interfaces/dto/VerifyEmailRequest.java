package com.zeno.modules.identity.interfaces.dto;

import jakarta.validation.constraints.NotBlank;

public record VerifyEmailRequest(@NotBlank(message = "Token is required") String token) {}

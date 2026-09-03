package com.niro.modules.identity.interfaces.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record ResendVerificationRequest(
        @NotBlank @Email(message = "Must be a valid email address") String email
) {}

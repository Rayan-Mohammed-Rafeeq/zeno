package com.zeno.config;

import com.zeno.modules.identity.domain.UserRole;

import java.util.UUID;

/**
 * The authenticated principal stored in the SecurityContext.
 * Carries only what's needed for authorization — no sensitive data.
 */
public record ZenoPrincipal(UUID userId, String email, UserRole role) {
}

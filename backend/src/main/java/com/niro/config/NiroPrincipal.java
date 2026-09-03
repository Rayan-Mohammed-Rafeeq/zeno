package com.niro.config;

import java.util.UUID;

/**
 * The authenticated principal stored in the SecurityContext.
 * Carries only what's needed for authorization — no sensitive data.
 */
public record NiroPrincipal(UUID userId, String email) {
}

package com.zeno.config;

import com.zeno.modules.identity.domain.UserRole;
import com.zeno.shared.exception.UnauthorizedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.UUID;

/**
 * Utility for accessing the current authenticated principal from anywhere in the application layer.
 */
public final class SecurityUtils {

    private SecurityUtils() {}

    public static ZenoPrincipal currentPrincipal() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || !(auth.getPrincipal() instanceof ZenoPrincipal)) {
            throw new UnauthorizedException();
        }
        return (ZenoPrincipal) auth.getPrincipal();
    }

    public static UUID currentUserId() {
        return currentPrincipal().userId();
    }

    public static UserRole currentRole() {
        return currentPrincipal().role();
    }

    public static boolean isAdmin() {
        return currentRole() == UserRole.ADMIN;
    }
}

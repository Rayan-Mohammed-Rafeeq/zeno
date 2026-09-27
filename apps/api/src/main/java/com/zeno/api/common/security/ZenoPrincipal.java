package com.zeno.api.common.security;

/**
 * Custom authentication principal that carries username, role, and organization context.
 * Stored in SecurityContext for every authenticated request.
 */
public class ZenoPrincipal {
    private final String username;
    private final String role;
    private final Long organizationId;

    public ZenoPrincipal(String username, String role, Long organizationId) {
        this.username = username;
        this.role = role;
        this.organizationId = organizationId;
    }

    public String getUsername() { return username; }
    public String getRole() { return role; }
    public Long getOrganizationId() { return organizationId; }

    @Override
    public String toString() {
        return "ZenoPrincipal{username='" + username + "', role='" + role + "', orgId=" + organizationId + "}";
    }
}

package com.niro.modules.identity.domain;

public enum UserRole {
    /** Full platform access; can manage users, view all data, configure settings. */
    ADMIN,
    /** Day-to-day analyst; can view and investigate all risk data but cannot manage users. */
    ANALYST,
    /** Read-only access; can view dashboards and reports but cannot take actions. */
    VIEWER
}

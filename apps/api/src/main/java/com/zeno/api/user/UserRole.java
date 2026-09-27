package com.zeno.api.user;

/**
 * Roles in the Zeno system.
 * Controls what actions a user can perform and what data they can see.
 */
public enum UserRole {
    /** 1. Pharmacist (Pharmacy Side) */
    PHARMACIST("Pharmacist"),

    /** 2. Practice Staff / Nurse (Practice / Clinic Side) */
    PRACTICE_STAFF("Practice Staff / Nurse"),

    /** 3. Doctor / Provider (Clinical Prescriber) */
    PROVIDER("Doctor / Provider"),

    /** Pharmacy technician / general staff */
    PHARMACY_STAFF("Pharmacy Staff"),

    /** Full system administrator */
    ADMIN("Administrator");

    private final String displayName;

    UserRole(String displayName) {
        this.displayName = displayName;
    }

    public String getDisplayName() {
        return displayName;
    }
}

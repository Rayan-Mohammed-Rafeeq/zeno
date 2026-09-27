package com.zeno.api.refill;

/**
 * Identifies the type of blocker preventing a refill from proceeding.
 * Drives the triage logic and determines what actions must be taken.
 */
public enum BlockerType {
    /** Prescription has no remaining refills authorized */
    NO_REFILLS,
    /** Provider must approve this refill before it can proceed */
    PROVIDER_APPROVAL_REQUIRED,
    /** A new prescription must be written — prior one is expired or invalid */
    NEW_PRESCRIPTION_REQUIRED,
    /** Patient must visit the provider before refill can be authorized */
    VISIT_REQUIRED,
    /** Required information is missing from the request or patient record */
    MISSING_INFORMATION,
    /** Insurance/PBM has blocked the claim */
    INSURANCE_BLOCK,
    /** Pharmacy-side issue (stock, formulary, etc.) */
    PHARMACY_ISSUE,
    /** Other/unclassified blocker */
    OTHER
}

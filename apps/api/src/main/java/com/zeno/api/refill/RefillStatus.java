package com.zeno.api.refill;

/**
 * All possible states of a RefillRequest in the Zeno workflow.
 * The state machine is the heart of the Zeno refill resolution platform.
 */
public enum RefillStatus {
    /** Patient or pharmacy has submitted the refill request */
    REQUESTED,
    /** The request is being evaluated */
    UNDER_REVIEW,
    /** A blocker has been detected — cannot proceed without resolution */
    BLOCKED,
    /** An action is required from someone to proceed */
    ACTION_REQUIRED,
    /** Waiting for the prescribing provider to approve */
    AWAITING_PROVIDER,
    /** Waiting for the practice/office staff to act */
    AWAITING_PRACTICE,
    /** Waiting for the pharmacy to act */
    AWAITING_PHARMACY,
    /** Waiting on insurance/PBM approval or information */
    AWAITING_INSURANCE,
    /** All blockers resolved — refill is ready to be dispensed */
    READY,
    /** The refill was successfully dispensed */
    COMPLETED,
    /** The request was cancelled */
    CANCELLED,
    /** Escalated to a supervisor or senior staff */
    ESCALATED
}

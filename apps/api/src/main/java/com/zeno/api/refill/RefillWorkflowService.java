package com.zeno.api.refill;

import com.zeno.api.common.exception.BusinessException;
import com.zeno.api.prescription.Prescription;
import com.zeno.api.resolution.ResolutionCase;
import com.zeno.api.resolution.ResolutionCaseService;
import com.zeno.api.user.User;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Set;

/**
 * The Refill Workflow Engine.
 *
 * This service drives refill requests through the state machine by applying
 * deterministic business rules to identify blockers and create resolution cases.
 *
 * Architecture principle: Logic lives here, NOT in controllers.
 *
 * AI integration point: The AI workflow service will call this engine's APIs
 * to read state and submit recommendations. It cannot directly mutate data.
 * The backend validates all transitions; humans approve clinical decisions.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class RefillWorkflowService {

    private static final Logger log = LoggerFactory.getLogger(RefillWorkflowService.class);
    private static final Set<String> DEMO_ACCOUNTS = Set.of(
            "demo.pharmacist", "demo.staff", "demo.provider",
            "sarah.chen", "mike.johnson", "dr.patel", "dr.williams", "lisa.martinez"
    );

    private final RefillRequestRepository refillRepository;
    private final RefillRequestService refillRequestService;
    private final ResolutionCaseService resolutionCaseService;

    /**
     * TRIAGE: Determine why a refill is stuck and create a resolution case.
     *
     * Applies deterministic rules to detect blockers.
     * Creates a ResolutionCase if a blocker is found.
     * Marks the RefillRequest as READY if no blockers exist.
     *
     * @return the updated RefillRequest
     */
    public RefillRequest triage(Long refillId, User actor) {
        RefillRequest request = refillRequestService.findById(refillId);

        if (!isTriageable(request)) {
            throw new BusinessException(
                "Cannot triage refill in status: " + request.getStatus() +
                ". Only REQUESTED or UNDER_REVIEW refills can be triaged."
            );
        }

        log.info("[refillId={}] Starting triage. prescriptionId={}", refillId, request.getPrescription().getId());

        // Transition to UNDER_REVIEW
        RefillStatus prev = request.getStatus();
        request.setStatus(RefillStatus.UNDER_REVIEW);
        refillRequestService.recordEvent(request, RefillEventType.REFILL_UNDER_REVIEW,
                prev, RefillStatus.UNDER_REVIEW,
                "Triage started — evaluating prescription eligibility and blockers",
                actor, triageActorLabel(actor));

        // === DETERMINISTIC BLOCKER DETECTION ===
        BlockerType blocker = detectBlocker(request.getPrescription());

        if (blocker != null) {
            return handleBlocker(request, blocker, actor);
        } else {
            return markReady(request, actor);
        }
    }

    /**
     * Demo automation: immediately triage a newly submitted demo refill only
     * when deterministic rules find a blocker. Blocked requests get a pending
     * resolution action for a person to review. Clear requests remain REQUESTED
     * so this automation cannot approve or advance a refill to READY.
     */
    public RefillRequest autoTriageDemoBlockedRefill(Long refillId, User requester) {
        RefillRequest request = refillRequestService.findById(refillId);
        if (requester == null || !DEMO_ACCOUNTS.contains(requester.getUsername())
                || !isTriageable(request)
                || detectBlocker(request.getPrescription()) == null) {
            return request;
        }

        log.info("[refillId={}] Automatically triaging blocked demo request", refillId);
        return triage(refillId, null);
    }

    /**
     * Applies deterministic rules to detect blockers.
     * Rules are evaluated in priority order.
     * Returns the first blocker found, or null if none.
     *
     * IMPORTANT: No LLM or AI is used here. These are explicit business rules.
     */
    private BlockerType detectBlocker(Prescription rx) {
        // Rule 1: Prescription is expired
        if (rx.isExpired()) {
            log.debug("Blocker detected: NEW_PRESCRIPTION_REQUIRED (prescription expired on {})", rx.getExpiryDate());
            return BlockerType.NEW_PRESCRIPTION_REQUIRED;
        }

        // Rule 2: No refills remaining
        if (rx.isOutOfRefills()) {
            log.debug("Blocker detected: NO_REFILLS (used {}/{} refills)", rx.getRefillsUsed(), rx.getRefillsAllowed());
            return BlockerType.NO_REFILLS;
        }

        // Rule 3: Prior authorization required
        if (rx.isRequiresPriorAuth()) {
            log.debug("Blocker detected: PROVIDER_APPROVAL_REQUIRED (prior auth required)");
            return BlockerType.PROVIDER_APPROVAL_REQUIRED;
        }

        // Rule 4: Missing required prescription fields
        if (isMissingRequiredInfo(rx)) {
            log.debug("Blocker detected: MISSING_INFORMATION");
            return BlockerType.MISSING_INFORMATION;
        }

        // No blockers detected
        return null;
    }

    private boolean isMissingRequiredInfo(Prescription rx) {
        return rx.getMedicationName() == null || rx.getMedicationName().isBlank()
                || rx.getQuantityDispensed() == null
                || rx.getDaysSupply() == null
                || rx.getProvider() == null;
    }

    private RefillRequest handleBlocker(RefillRequest request, BlockerType blocker, User actor) {
        log.info("[refillId={}] Blocker detected: {}", request.getId(), blocker);

        request.setBlockerType(blocker);
        request.setStatus(mapBlockerToStatus(blocker));
        refillRepository.save(request);

        refillRequestService.recordEvent(request, RefillEventType.BLOCKER_IDENTIFIED,
                RefillStatus.UNDER_REVIEW, request.getStatus(),
                "Blocker identified: " + blocker.name() + " — creating resolution case",
                actor, triageActorLabel(actor));

        // Create a resolution case to coordinate the resolution
        String reason = buildBlockerReason(blocker, request.getPrescription());
        resolutionCaseService.createCase(request, blocker, reason, actor);

        return request;
    }

    private RefillRequest markReady(RefillRequest request, User actor) {
        log.info("[refillId={}] No blockers detected — marking READY", request.getId());

        // Increment refills used
        Prescription rx = request.getPrescription();
        rx.setRefillsUsed(rx.getRefillsUsed() + 1);

        request.setStatus(RefillStatus.READY);
        refillRepository.save(request);

        refillRequestService.recordEvent(request, RefillEventType.REFILL_READY,
                RefillStatus.UNDER_REVIEW, RefillStatus.READY,
                "No blockers detected — refill is approved and ready to be dispensed",
                actor, triageActorLabel(actor));

        return request;
    }

    /**
     * Complete a refill after dispensing.
     */
    public RefillRequest complete(Long refillId, User actor) {
        RefillRequest request = refillRequestService.findById(refillId);

        if (request.getStatus() != RefillStatus.READY) {
            throw new BusinessException("Cannot complete a refill that is not in READY status. Current: " + request.getStatus());
        }

        request.setStatus(RefillStatus.COMPLETED);
        refillRepository.save(request);

        refillRequestService.recordEvent(request, RefillEventType.REFILL_COMPLETED,
                RefillStatus.READY, RefillStatus.COMPLETED,
                "Refill dispensed and completed", actor, null);

        return request;
    }

    /**
     * After a resolution case is resolved, re-triage to verify the blocker is cleared.
     */
    public RefillRequest retriage(Long refillId, User actor) {
        RefillRequest request = refillRequestService.findById(refillId);

        // Clear previous blocker state
        request.setBlockerType(null);
        request.setStatus(RefillStatus.REQUESTED);
        refillRepository.save(request);

        return triage(refillId, actor);
    }

    // ─── Helpers ────────────────────────────────────────────────────────────

    private boolean isTriageable(RefillRequest request) {
        return request.getStatus() == RefillStatus.REQUESTED
                || request.getStatus() == RefillStatus.UNDER_REVIEW;
    }

    private String triageActorLabel(User actor) {
        return actor == null
                ? "Automated triage engine"
                : "Triage engine (initiated by " + actor.getUsername() + ")";
    }

    private RefillStatus mapBlockerToStatus(BlockerType blocker) {
        return switch (blocker) {
            case NO_REFILLS, PROVIDER_APPROVAL_REQUIRED, NEW_PRESCRIPTION_REQUIRED, VISIT_REQUIRED
                    -> RefillStatus.AWAITING_PROVIDER;
            case MISSING_INFORMATION
                    -> RefillStatus.ACTION_REQUIRED;
            case INSURANCE_BLOCK
                    -> RefillStatus.AWAITING_INSURANCE;
            case PHARMACY_ISSUE
                    -> RefillStatus.AWAITING_PHARMACY;
            default -> RefillStatus.BLOCKED;
        };
    }

    private String buildBlockerReason(BlockerType blocker, Prescription rx) {
        return switch (blocker) {
            case NO_REFILLS -> String.format(
                "Prescription has used all %d authorized refills. Provider must authorize additional refills or issue a new prescription.",
                rx.getRefillsAllowed());
            case NEW_PRESCRIPTION_REQUIRED -> String.format(
                "Prescription expired on %s. A new prescription must be written by the provider.",
                rx.getExpiryDate());
            case PROVIDER_APPROVAL_REQUIRED ->
                "This prescription requires prior authorization or explicit provider approval before dispensing.";
            case MISSING_INFORMATION ->
                "Required information is missing from the prescription or patient record. Please review and complete.";
            case INSURANCE_BLOCK ->
                "Insurance or PBM has flagged this prescription. Prior authorization or claim correction may be required.";
            case PHARMACY_ISSUE ->
                "A pharmacy-side issue is preventing this refill from proceeding (formulary, stock, or administrative).";
            default ->
                "A blocker has been identified. Please review the case details.";
        };
    }
}

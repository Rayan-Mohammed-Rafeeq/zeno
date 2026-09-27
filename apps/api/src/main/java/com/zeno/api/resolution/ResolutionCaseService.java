package com.zeno.api.resolution;

import com.zeno.api.ai.AiRecommendationResponse;
import com.zeno.api.ai.AiResolutionRecommendationService;
import com.zeno.api.common.exception.BusinessException;
import com.zeno.api.common.exception.ResourceNotFoundException;
import com.zeno.api.refill.BlockerType;
import com.zeno.api.refill.RefillEvent;
import com.zeno.api.refill.RefillEventRepository;
import com.zeno.api.refill.RefillEventType;
import com.zeno.api.refill.RefillRequest;
import com.zeno.api.refill.RefillRequestRepository;
import com.zeno.api.refill.RefillStatus;
import com.zeno.api.prescription.Prescription;
import com.zeno.api.prescription.PrescriptionRepository;
import com.zeno.api.prescription.PrescriptionStatus;
import com.zeno.api.refill.RefillWorkflowService;
import com.zeno.api.user.User;
import com.zeno.api.user.UserRepository;
import com.zeno.api.user.UserRole;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Service for managing resolution cases.
 * A resolution case coordinates the actions needed to resolve a refill blocker.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class ResolutionCaseService {

    private static final Logger log = LoggerFactory.getLogger(ResolutionCaseService.class);

    private final ResolutionCaseRepository caseRepository;
    private final ResolutionActionRepository actionRepository;
    private final RefillRequestRepository refillRepository;
    private final RefillEventRepository eventRepository;
    private final UserRepository userRepository;
    private final AiResolutionRecommendationService aiRecommendationService;
    private final PrescriptionRepository prescriptionRepository;

    @org.springframework.beans.factory.annotation.Autowired
    @Lazy
    private RefillWorkflowService refillWorkflowService;

    @Transactional(readOnly = true)
    public ResolutionCase findById(Long id) {
        return caseRepository.findById(id)
                .orElseThrow(() -> ResourceNotFoundException.of("ResolutionCase", id));
    }

    @Transactional
    public ResolutionCase findByIdOrRefillId(Long id) {
        // 1. Try finding by resolution case ID
        Optional<ResolutionCase> byCaseId = caseRepository.findWithDetailsById(id);
        if (byCaseId.isPresent()) {
            return byCaseId.get();
        }

        // 2. Try finding by refill request ID
        Optional<ResolutionCase> byRefillId = caseRepository.findWithDetailsByRefillRequestId(id);
        if (byRefillId.isPresent()) {
            return byRefillId.get();
        }

        // 3. If a refill request exists with this ID, auto-initialize case if blocked
        Optional<RefillRequest> refillOpt = refillRepository.findWithDetailsById(id);
        if (refillOpt.isPresent()) {
            RefillRequest refill = refillOpt.get();
            BlockerType blocker = refill.getBlockerType() != null ? refill.getBlockerType() : BlockerType.OTHER;
            return createCase(refill, blocker, "Resolution case for refill #" + id, null);
        }

        throw ResourceNotFoundException.of("ResolutionCase", id);
    }

    @Transactional
    public Optional<ResolutionCase> findOptionalByRefillRequestId(Long refillId) {
        Optional<ResolutionCase> existing = caseRepository.findWithDetailsByRefillRequestId(refillId);
        if (existing.isPresent()) {
            return existing;
        }

        Optional<RefillRequest> refillOpt = refillRepository.findWithDetailsById(refillId);
        if (refillOpt.isPresent()) {
            RefillRequest refill = refillOpt.get();
            if (refill.getBlockerType() != null) {
                return Optional.of(createCase(refill, refill.getBlockerType(), "Resolution case for blocked refill #" + refillId, null));
            }
        }

        return Optional.empty();
    }

    @Transactional(readOnly = true)
    public ResolutionCase findByRefillRequestId(Long refillId) {
        return findOptionalByRefillRequestId(refillId)
                .orElseThrow(() -> new ResourceNotFoundException("No resolution case found for refill request: " + refillId));
    }

    @Transactional(readOnly = true)
    public List<ResolutionCase> findActiveByOrganizationId(Long orgId) {
        return caseRepository.findActiveByOrganizationId(orgId);
    }

    /**
     * Creates a new resolution case for a blocked refill request.
     * Also creates the first suggested action based on the blocker type.
     */
    public ResolutionCase createCase(RefillRequest refillRequest, BlockerType blockerType,
                                     String reason, User createdBy) {
        log.info("[refillId={}] Creating resolution case for blocker={}", refillRequest.getId(), blockerType);

        Optional<ResolutionCase> existing = caseRepository.findByRefillRequestId(refillRequest.getId());
        ResolutionCase resolutionCase;
        if (existing.isPresent()) {
            resolutionCase = existing.get();
            resolutionCase.setBlockerType(blockerType);
            resolutionCase.setStatus(ResolutionStatus.OPEN);
            resolutionCase.setPriority(refillRequest.getPriority());
            resolutionCase.setReason(reason);
            resolutionCase.setResolutionSummary(null);
            resolutionCase.setResolvedAt(null);
        } else {
            resolutionCase = ResolutionCase.builder()
                    .refillRequest(refillRequest)
                    .blockerType(blockerType)
                    .status(ResolutionStatus.OPEN)
                    .priority(refillRequest.getPriority())
                    .reason(reason)
                    .build();
        }

        ResolutionCase saved = caseRepository.save(resolutionCase);

        // Record the case creation event
        recordEvent(refillRequest, RefillEventType.CASE_CREATED, null,
                "Resolution case #" + saved.getId() + " created for blocker: " + blockerType,
                createdBy, triageActorLabel(createdBy), saved.getId(), null);

        // Auto-create the first suggested action based on blocker type
        createInitialAction(saved, blockerType, createdBy);

        return saved;
    }

    /**
     * Create an action on a resolution case.
     */
    public ResolutionAction createAction(Long caseId, CreateActionCommand cmd, User createdBy) {
        ResolutionCase resolutionCase = findByIdOrRefillId(caseId);

        User assignedUser = null;
        if (cmd.assignedUserId() != null) {
            assignedUser = userRepository.findById(cmd.assignedUserId())
                    .orElseThrow(() -> ResourceNotFoundException.of("User", cmd.assignedUserId()));
        }

        ResolutionAction action = ResolutionAction.builder()
                .resolutionCase(resolutionCase)
                .actionType(cmd.actionType())
                .assignedRole(cmd.assignedRole())
                .assignedUser(assignedUser)
                .description(cmd.description())
                .dueAt(cmd.dueAt())
                .status(ActionStatus.PENDING)
                .build();

        ResolutionAction saved = actionRepository.save(action);

        recordEvent(resolutionCase.getRefillRequest(), RefillEventType.ACTION_CREATED, null,
                "Action created: " + cmd.actionType() + " — " + cmd.description(),
                createdBy, null, resolutionCase.getId(), saved.getId());

        return saved;
    }

    /**
     * Complete an action and optionally advance the resolution case.
     */
    public ResolutionAction completeAction(Long caseId, Long actionId, String notes, User completedBy) {
        ResolutionAction action = actionRepository.findById(actionId)
                .orElseThrow(() -> ResourceNotFoundException.of("ResolutionAction", actionId));

        ResolutionCase resolutionCase = findByIdOrRefillId(caseId);

        if (!action.getResolutionCase().getId().equals(resolutionCase.getId())) {
            throw new BusinessException("Action does not belong to the specified case");
        }

        if (action.getStatus() == ActionStatus.COMPLETED || action.getStatus() == ActionStatus.CANCELLED) {
            throw new BusinessException("Cannot complete an action in status: " + action.getStatus());
        }

        action.setStatus(ActionStatus.COMPLETED);
        action.setCompletionNotes(notes);
        action.setCompletedAt(LocalDateTime.now());
        action.setCompletedBy(completedBy);

        ResolutionAction saved = actionRepository.save(action);

        recordEvent(resolutionCase.getRefillRequest(), RefillEventType.ACTION_COMPLETED, null,
                "Action completed: " + action.getActionType() + ". Notes: " + notes,
                completedBy, null, caseId, actionId);

        // Move case to IN_PROGRESS if it's still OPEN
        if (resolutionCase.getStatus() == ResolutionStatus.OPEN) {
            resolutionCase.setStatus(ResolutionStatus.IN_PROGRESS);
            caseRepository.save(resolutionCase);
        }

        return saved;
    }

    /**
     * Mark a resolution case as resolved with simple summary.
     */
    public ResolutionCase resolve(Long caseId, String resolutionSummary, User resolvedBy) {
        return resolve(caseId, new ResolveCaseRequest(resolutionSummary, null, null, null), resolvedBy);
    }

    /**
     * Mark a resolution case as resolved, applying any clinical updates (e.g. Doctor's new prescription authorization).
     * Updates case, updates prescription if renewed, records audit timeline events, and retriages refill to advance state.
     */
    public ResolutionCase resolve(Long caseId, ResolveCaseRequest request, User resolvedBy) {
        ResolutionCase resolutionCase = findByIdOrRefillId(caseId);

        String summary = (request != null && request.resolutionSummary() != null && !request.resolutionSummary().isBlank())
                ? request.resolutionSummary()
                : "Resolved";

        RefillRequest refillRequest = resolutionCase.getRefillRequest();
        Prescription rx = refillRequest.getPrescription();
        BlockerType blocker = resolutionCase.getBlockerType();

        boolean prescriptionUpdated = false;

        // Clinical / Option B: Prescriber Authority Enforcement for Expired Prescriptions
        if (blocker == BlockerType.NEW_PRESCRIPTION_REQUIRED) {
            if (resolvedBy != null && resolvedBy.getRole() != UserRole.PROVIDER && resolvedBy.getRole() != UserRole.ADMIN) {
                log.warn("[caseId={}] Non-prescriber user {} with role {} attempted to authorize a new prescription",
                        caseId, resolvedBy.getUsername(), resolvedBy.getRole());
                throw new BusinessException(
                        "Prescriptive Authority Required: Pharmacists and clinic staff cannot write or issue new prescriptions. Only a licensed prescriber (Doctor / Provider) can authorize an expired prescription renewal."
                );
            }
        }

        // Clinical / Option B: Provider Prescription Renewal & Authorization
        if (request != null && (request.newExpiryDate() != null || request.newRefillsAllowed() != null || request.newRxNumber() != null)) {
            if (request.newExpiryDate() != null) {
                rx.setExpiryDate(request.newExpiryDate());
            }
            if (request.newRefillsAllowed() != null) {
                rx.setRefillsAllowed(request.newRefillsAllowed());
                rx.setRefillsUsed(0);
            }
            if (request.newRxNumber() != null && !request.newRxNumber().isBlank()) {
                rx.setRxNumber(request.newRxNumber());
            }
            rx.setStatus(PrescriptionStatus.ACTIVE);
            prescriptionRepository.save(rx);
            prescriptionUpdated = true;

            recordEvent(refillRequest, RefillEventType.ACTION_COMPLETED, null,
                    String.format("Prescription renewed and authorized by %s: Expiry %s, %d refills allowed (Rx# %s)",
                            resolvedBy != null ? resolvedBy.getUsername() : "provider",
                            rx.getExpiryDate(), rx.getRefillsAllowed(), rx.getRxNumber()),
                    resolvedBy, null, caseId, null);
        } else if (blocker == BlockerType.NEW_PRESCRIPTION_REQUIRED) {
            // Default 1-year renewal if resolved without explicit dates
            rx.setExpiryDate(LocalDate.now().plusYears(1));
            rx.setRefillsAllowed(Math.max(rx.getRefillsAllowed(), 3));
            rx.setRefillsUsed(0);
            rx.setStatus(PrescriptionStatus.ACTIVE);
            prescriptionRepository.save(rx);
            prescriptionUpdated = true;
        }

        if (blocker == BlockerType.NO_REFILLS && !prescriptionUpdated) {
            rx.setRefillsAllowed(Math.max(rx.getRefillsAllowed() + 3, rx.getRefillsUsed() + 3));
            prescriptionRepository.save(rx);
        } else if (blocker == BlockerType.PROVIDER_APPROVAL_REQUIRED) {
            rx.setRequiresPriorAuth(false);
            prescriptionRepository.save(rx);
        }

        resolutionCase.setStatus(ResolutionStatus.RESOLVED);
        resolutionCase.setResolutionSummary(summary);
        resolutionCase.setResolvedAt(LocalDateTime.now());
        ResolutionCase saved = caseRepository.save(resolutionCase);

        recordEvent(refillRequest, RefillEventType.CASE_RESOLVED, null,
                "Resolution case resolved: " + summary,
                resolvedBy, null, caseId, null);

        // Clear blocker and advance refill request to READY
        refillRequest.setBlockerType(null);
        refillRequest.setStatus(RefillStatus.READY);
        refillRepository.save(refillRequest);

        recordEvent(refillRequest, RefillEventType.REFILL_READY,
                RefillStatus.READY,
                "All blockers resolved — refill approved and ready to be dispensed",
                resolvedBy, null, caseId, null);

        return saved;
    }

    /**
     * Escalate a resolution case.
     */
    public ResolutionCase escalate(Long caseId, String reason, User escalatedBy) {
        ResolutionCase resolutionCase = findByIdOrRefillId(caseId);

        resolutionCase.setStatus(ResolutionStatus.ESCALATED);
        caseRepository.save(resolutionCase);

        RefillRequest refillRequest = resolutionCase.getRefillRequest();
        refillRequest.setStatus(RefillStatus.ESCALATED);
        refillRepository.save(refillRequest);

        recordEvent(refillRequest, RefillEventType.CASE_ESCALATED, null,
                "Case escalated: " + reason,
                escalatedBy, null, caseId, null);

        return resolutionCase;
    }

    // ─── AI Recommendation ──────────────────────────────────────────────────

    /**
     * Request an AI recommendation for a resolution case and persist it.
     *
     * This method:
     * 1. Calls the AI service to generate a structured recommendation
     * 2. Persists the recommendation JSON to resolution_cases.ai_recommendation
     * 3. Records an audit event (AI_RECOMMENDATION_RECEIVED)
     *
     * Returns Optional.empty() if AI is unavailable — workflow continues without AI.
     * NEVER blocks or throws on AI failure.
     *
     * @param caseId        The resolution case ID
     * @param userRole      Role of the requesting user (for context)
     * @param requestedBy   The user requesting AI analysis (may be null for system calls)
     * @return Optional containing the structured recommendation, or empty if unavailable
     */
    public Optional<AiRecommendationResponse> requestAiRecommendation(
            Long caseId, String userRole, User requestedBy
    ) {
        ResolutionCase resolutionCase = findByIdOrRefillId(caseId);
        RefillRequest refillRequest = resolutionCase.getRefillRequest();

        log.info("[caseId={}] Requesting AI recommendation", caseId);

        try {
            Optional<AiRecommendationResponse> recommendationOpt =
                    aiRecommendationService.getStructuredRecommendation(
                            resolutionCase, refillRequest, userRole
                    );

            if (recommendationOpt.isEmpty()) {
                log.warn("[caseId={}] AI recommendation unavailable", caseId);
                recordEvent(refillRequest, RefillEventType.AI_RECOMMENDATION_RECEIVED, null,
                        "AI assistance unavailable. Continue with manual workflow.",
                        requestedBy, "ai-recommender", caseId, null);
                return Optional.empty();
            }

            AiRecommendationResponse recommendation = recommendationOpt.get();

            // Persist recommendation JSON to the resolution case
            // We serialize just the essential fields for the ai_recommendation column
            String summaryForStorage = buildRecommendationSummary(recommendation);
            resolutionCase.setAiRecommendation(summaryForStorage);
            caseRepository.save(resolutionCase);

            // Audit event
            String eventDescription = String.format(
                    "AI recommendation generated: %s → %s (confidence: %.0f%%, safety: %s)",
                    recommendation.getBlocker(),
                    recommendation.getRecommendedAction(),
                    recommendation.getConfidence() != null ? recommendation.getConfidence() * 100 : 0,
                    recommendation.getSafetyClass()
            );
            recordEvent(refillRequest, RefillEventType.AI_RECOMMENDATION_RECEIVED, null,
                    eventDescription, requestedBy, "ai-recommender", caseId, null);

            log.info("[caseId={}] AI recommendation persisted: action={}, role={}, safetyClass={}",
                    caseId,
                    recommendation.getRecommendedAction(),
                    recommendation.getAssignedRole(),
                    recommendation.getSafetyClass());

            return Optional.of(recommendation);

        } catch (Exception e) {
            log.error("[caseId={}] Error requesting AI recommendation: {}", caseId, e.getMessage());
            return Optional.empty();
        }
    }

    /** Build a concise summary string for ai_recommendation storage. */
    private String buildRecommendationSummary(AiRecommendationResponse rec) {
        return String.format(
                """
                {"blocker":"%s","action":"%s","role":"%s","confidence":%.2f,"safety":"%s","summary":"%s","next_step":"%s"}""",
                rec.getBlocker(),
                rec.getRecommendedAction(),
                rec.getAssignedRole(),
                rec.getConfidence() != null ? rec.getConfidence() : 0.0,
                rec.getSafetyClass(),
                escapeJson(rec.getUiSummary()),
                escapeJson(rec.getUiNextStep())
        );
    }

    private static String escapeJson(String value) {
        if (value == null) return "";
        return value.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", " ");
    }

    // ─── Actions list ───────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<ResolutionAction> findActionsByCase(Long caseId) {
        ResolutionCase resolutionCase = findByIdOrRefillId(caseId);
        return actionRepository.findByResolutionCaseIdOrderByCreatedAtAsc(resolutionCase.getId());
    }

    // ─── Helpers ────────────────────────────────────────────────────────────

    /** Creates the first suggested action based on the detected blocker. */
    private void createInitialAction(ResolutionCase resolutionCase, BlockerType blockerType, User createdBy) {
        ActionType actionType = switch (blockerType) {
            case NO_REFILLS, PROVIDER_APPROVAL_REQUIRED -> ActionType.REQUEST_PROVIDER_APPROVAL;
            case NEW_PRESCRIPTION_REQUIRED -> ActionType.REQUEST_NEW_PRESCRIPTION;
            case VISIT_REQUIRED -> ActionType.FOLLOW_UP_WITH_PRACTICE;
            case MISSING_INFORMATION -> ActionType.REQUEST_MISSING_INFORMATION;
            case INSURANCE_BLOCK -> ActionType.VERIFY_INSURANCE;
            case PHARMACY_ISSUE -> ActionType.CONTACT_PHARMACY;
            default -> ActionType.OTHER;
        };

        String description = switch (blockerType) {
            case NO_REFILLS -> "Contact provider to authorize additional refills for this prescription.";
            case NEW_PRESCRIPTION_REQUIRED -> "Request provider to issue a new prescription.";
            case PROVIDER_APPROVAL_REQUIRED -> "Send prior authorization request to provider for review and approval.";
            case VISIT_REQUIRED -> "Schedule patient visit with provider before refill can proceed.";
            case MISSING_INFORMATION -> "Obtain and complete the missing prescription/patient information.";
            case INSURANCE_BLOCK -> "Contact insurance/PBM to resolve claim rejection or obtain prior auth.";
            case PHARMACY_ISSUE -> "Contact pharmacy to resolve formulary or dispensing issue.";
            default -> "Review and resolve the identified blocker.";
        };

        ResolutionAction action = ResolutionAction.builder()
                .resolutionCase(resolutionCase)
                .actionType(actionType)
                .description(description)
                .status(ActionStatus.PENDING)
                .build();

        ResolutionAction saved = actionRepository.save(action);
        recordEvent(resolutionCase.getRefillRequest(), RefillEventType.ACTION_CREATED, null,
                "Automated pending action created: " + actionType + " — " + description,
                createdBy, triageActorLabel(createdBy), resolutionCase.getId(), saved.getId());
    }

    private String triageActorLabel(User actor) {
        return actor == null
                ? "Automated triage engine"
                : "Triage engine (initiated by " + actor.getUsername() + ")";
    }

    private void recordEvent(RefillRequest request, RefillEventType type,
                              RefillStatus toStatus, String description,
                              User actor, String actorLabel,
                              Long relatedCaseId, Long relatedActionId) {
        RefillEvent event = RefillEvent.builder()
                .refillRequest(request)
                .eventType(type)
                .toStatus(toStatus)
                .description(description)
                .actor(actor)
                .actorLabel(actorLabel != null ? actorLabel : (actor != null ? actor.getUsername() : "system"))
                .relatedCaseId(relatedCaseId)
                .relatedActionId(relatedActionId)
                .build();
        eventRepository.save(event);
    }
}

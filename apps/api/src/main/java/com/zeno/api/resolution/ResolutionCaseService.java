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
import com.zeno.api.user.User;
import com.zeno.api.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

    @Transactional(readOnly = true)
    public ResolutionCase findById(Long id) {
        return caseRepository.findById(id)
                .orElseThrow(() -> ResourceNotFoundException.of("ResolutionCase", id));
    }

    @Transactional(readOnly = true)
    public ResolutionCase findByRefillRequestId(Long refillId) {
        return caseRepository.findByRefillRequestId(refillId)
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

        ResolutionCase resolutionCase = ResolutionCase.builder()
                .refillRequest(refillRequest)
                .blockerType(blockerType)
                .status(ResolutionStatus.OPEN)
                .priority(refillRequest.getPriority())
                .reason(reason)
                .build();

        ResolutionCase saved = caseRepository.save(resolutionCase);

        // Record the case creation event
        recordEvent(refillRequest, RefillEventType.CASE_CREATED, null,
                "Resolution case #" + saved.getId() + " created for blocker: " + blockerType,
                createdBy, "triage-engine", saved.getId(), null);

        // Auto-create the first suggested action based on blocker type
        createInitialAction(saved, blockerType, createdBy);

        return saved;
    }

    /**
     * Create an action on a resolution case.
     */
    public ResolutionAction createAction(Long caseId, CreateActionCommand cmd, User createdBy) {
        ResolutionCase resolutionCase = findById(caseId);

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
                createdBy, null, caseId, saved.getId());

        return saved;
    }

    /**
     * Complete an action and optionally advance the resolution case.
     */
    public ResolutionAction completeAction(Long caseId, Long actionId, String notes, User completedBy) {
        ResolutionAction action = actionRepository.findById(actionId)
                .orElseThrow(() -> ResourceNotFoundException.of("ResolutionAction", actionId));

        if (!action.getResolutionCase().getId().equals(caseId)) {
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

        ResolutionCase resolutionCase = action.getResolutionCase();
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
     * Mark a resolution case as resolved.
     * Updates both the case and the associated refill request.
     */
    public ResolutionCase resolve(Long caseId, String resolutionSummary, User resolvedBy) {
        ResolutionCase resolutionCase = findById(caseId);

        resolutionCase.setStatus(ResolutionStatus.RESOLVED);
        resolutionCase.setResolutionSummary(resolutionSummary);
        resolutionCase.setResolvedAt(LocalDateTime.now());
        ResolutionCase saved = caseRepository.save(resolutionCase);

        // Update the refill request status
        RefillRequest refillRequest = resolutionCase.getRefillRequest();
        refillRequest.setBlockerType(null);
        refillRequest.setStatus(RefillStatus.UNDER_REVIEW); // Will be retriaged
        refillRepository.save(refillRequest);

        recordEvent(refillRequest, RefillEventType.CASE_RESOLVED, null,
                "Resolution case resolved: " + resolutionSummary,
                resolvedBy, null, caseId, null);

        return saved;
    }

    /**
     * Escalate a resolution case.
     */
    public ResolutionCase escalate(Long caseId, String reason, User escalatedBy) {
        ResolutionCase resolutionCase = findById(caseId);

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
        ResolutionCase resolutionCase = findById(caseId);
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
        return actionRepository.findByResolutionCaseIdOrderByCreatedAtAsc(caseId);
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

        actionRepository.save(action);
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

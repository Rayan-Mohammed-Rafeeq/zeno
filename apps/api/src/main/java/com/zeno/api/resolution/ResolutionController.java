package com.zeno.api.resolution;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.zeno.api.ai.AiRecommendationResponse;
import com.zeno.api.common.security.ZenoPrincipal;
import com.zeno.api.user.User;
import com.zeno.api.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/resolutions")
@RequiredArgsConstructor
public class ResolutionController {

    private final ResolutionCaseService caseService;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    @GetMapping
    public ResponseEntity<List<ResolutionCase>> getAll(
            @AuthenticationPrincipal ZenoPrincipal principal) {
        Long orgId = principal != null ? principal.getOrganizationId() : null;
        if (orgId != null) {
            return ResponseEntity.ok(caseService.findActiveByOrganizationId(orgId));
        }
        return ResponseEntity.ok(List.of());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ResolutionCase> getById(@PathVariable Long id) {
        return ResponseEntity.ok(caseService.findByIdOrRefillId(id));
    }

    @GetMapping("/refill/{refillId}")
    public ResponseEntity<?> getByRefillId(@PathVariable Long refillId) {
        return caseService.findOptionalByRefillRequestId(refillId)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @GetMapping("/{id}/actions")
    public ResponseEntity<List<ResolutionActionResponse>> getActions(@PathVariable Long id) {
        return ResponseEntity.ok(caseService.findActionsByCase(id).stream()
                .map(ResolutionActionResponse::from).toList());
    }

    @PostMapping("/{id}/actions")
    public ResponseEntity<ResolutionAction> createAction(
            @PathVariable Long id,
            @RequestBody CreateActionRequest req,
            @AuthenticationPrincipal ZenoPrincipal principal) {
        User actor = resolveActor(principal);
        CreateActionCommand cmd = new CreateActionCommand(
                req.actionType(), req.assignedRole(), req.assignedUserId(),
                req.description(), req.dueAt()
        );
        ResolutionAction action = caseService.createAction(id, cmd, actor);
        return ResponseEntity.status(HttpStatus.CREATED).body(action);
    }

    @PostMapping("/{id}/actions/{actionId}/complete")
    public ResponseEntity<ResolutionAction> completeAction(
            @PathVariable Long id,
            @PathVariable Long actionId,
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal ZenoPrincipal principal) {
        User actor = resolveActor(principal);
        String notes = body.getOrDefault("notes", "");
        return ResponseEntity.ok(caseService.completeAction(id, actionId, notes, actor));
    }

    @PostMapping("/{id}/resolve")
    public ResponseEntity<ResolutionCase> resolve(
            @PathVariable Long id,
            @RequestBody(required = false) ResolveCaseRequest req,
            @AuthenticationPrincipal ZenoPrincipal principal) {
        User actor = resolveActor(principal);
        return ResponseEntity.ok(caseService.resolve(id, req, actor));
    }

    @PostMapping("/{id}/escalate")
    public ResponseEntity<ResolutionCase> escalate(
            @PathVariable Long id,
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal ZenoPrincipal principal) {
        User actor = resolveActor(principal);
        String reason = body.getOrDefault("reason", "Escalated");
        return ResponseEntity.ok(caseService.escalate(id, reason, actor));
    }

    /**
     * POST /api/resolutions/{id}/recommendation
     *
     * Request AI analysis for this resolution case.
     * Returns the structured recommendation if AI is available.
     * Returns 503 with a human-readable message if AI is unavailable — the
     * frontend should display "Continue with manual workflow" to the user.
     *
     * The AI recommendation is persisted to resolution_cases.ai_recommendation
     * and an audit event is recorded, but NO workflow state change occurs.
     * Clinical decisions remain human-controlled.
     */
    @PostMapping("/{id}/recommendation")
    public ResponseEntity<?> requestRecommendation(
            @PathVariable Long id,
            @AuthenticationPrincipal ZenoPrincipal principal) {
        User actor = resolveActor(principal);
        String userRole = principal != null ? principal.getRole() : "UNKNOWN";

        Optional<AiRecommendationResponse> recommendation =
                caseService.requestAiRecommendation(id, userRole, actor);

        if (recommendation.isEmpty()) {
            return ResponseEntity.status(503).body(Map.of(
                    "available", false,
                    "message", "AI assistance unavailable. Continue with manual workflow."
            ));
        }

        return ResponseEntity.ok(Map.of(
                "available", true,
                "caseId", id,
                "recommendation", recommendation.get()
        ));
    }

    /**
     * GET /api/resolutions/{id}/recommendation
     *
     * Return the persisted AI recommendation JSON for a case (if any).
     * Used by the frontend to display the recommendation without re-running AI.
     */
    @GetMapping("/{id}/recommendation")
    public ResponseEntity<?> getPersistedRecommendation(@PathVariable Long id) {
        ResolutionCase resolutionCase = caseService.findByIdOrRefillId(id);
        String stored = resolutionCase.getAiRecommendation();

        if (stored == null || stored.isBlank()) {
            return ResponseEntity.ok(Map.of(
                    "available", false,
                    "message", "No AI recommendation has been generated for this case."
            ));
        }

        try {
            Map<String, Object> recommendation = objectMapper.readValue(
                    stored, new TypeReference<>() {}
            );
            return ResponseEntity.ok(Map.of(
                    "available", true,
                    "caseId", id,
                    "recommendation", recommendation
            ));
        } catch (Exception invalidStoredRecommendation) {
            return ResponseEntity.ok(Map.of(
                    "available", false,
                    "message", "Stored AI recommendation is unavailable. Continue with manual workflow."
            ));
        }
    }

    private User resolveActor(ZenoPrincipal principal) {
        if (principal != null) {
            return userRepository.findByUsername(principal.getUsername()).orElse(null);
        }
        var auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getName() != null && !"anonymousUser".equals(auth.getName())) {
            return userRepository.findByUsername(auth.getName()).orElse(null);
        }
        return null;
    }
}

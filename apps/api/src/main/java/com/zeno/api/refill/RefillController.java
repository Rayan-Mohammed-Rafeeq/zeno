package com.zeno.api.refill;

import com.zeno.api.common.security.ZenoPrincipal;
import com.zeno.api.user.User;
import com.zeno.api.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/refills")
@RequiredArgsConstructor
public class RefillController {

    private final RefillRequestService refillService;
    private final RefillWorkflowService workflowService;
    private final RefillEventRepository eventRepository;
    private final UserRepository userRepository;

    @PostMapping
    public ResponseEntity<RefillRequest> createRefill(
            @RequestBody CreateRefillRequestDto dto,
            @AuthenticationPrincipal ZenoPrincipal principal) {

        User actor = resolveActor(principal);
        Long userId = actor != null ? actor.getId() : null;

        CreateRefillRequestCommand cmd = new CreateRefillRequestCommand(
                dto.prescriptionId(),
                dto.pharmacyId(),
                userId,
                dto.priority(),
                dto.notes()
        );

        RefillRequest created = refillService.createRefillRequest(cmd);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @GetMapping
    public ResponseEntity<List<RefillRequest>> getRefills(
            @AuthenticationPrincipal ZenoPrincipal principal) {
        Long orgId = principal != null ? principal.getOrganizationId() : null;
        if (orgId != null) {
            return ResponseEntity.ok(refillService.findActiveByOrganizationId(orgId));
        }
        return ResponseEntity.ok(refillService.findAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<RefillRequest> getRefill(@PathVariable Long id) {
        return ResponseEntity.ok(refillService.findById(id));
    }

    @PostMapping("/{id}/triage")
    public ResponseEntity<RefillRequest> triage(
            @PathVariable Long id,
            @AuthenticationPrincipal ZenoPrincipal principal) {
        User actor = resolveActor(principal);
        return ResponseEntity.ok(workflowService.triage(id, actor));
    }

    @PostMapping("/{id}/complete")
    public ResponseEntity<RefillRequest> complete(
            @PathVariable Long id,
            @AuthenticationPrincipal ZenoPrincipal principal) {
        User actor = resolveActor(principal);
        return ResponseEntity.ok(workflowService.complete(id, actor));
    }

    @PostMapping("/{id}/cancel")
    public ResponseEntity<RefillRequest> cancel(
            @PathVariable Long id,
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal ZenoPrincipal principal) {
        User actor = resolveActor(principal);
        String reason = body.getOrDefault("reason", "Cancelled by user");
        return ResponseEntity.ok(refillService.cancel(id, reason, actor));
    }

    @GetMapping("/{id}/timeline")
    @Transactional(readOnly = true)
    public ResponseEntity<List<RefillEventResponse>> getTimeline(@PathVariable Long id) {
        // Verify refill exists
        refillService.findById(id);
        List<RefillEventResponse> events = eventRepository.findByRefillRequestIdOrderByCreatedAtAsc(id)
                .stream().map(RefillEventResponse::from).toList();
        return ResponseEntity.ok(events);
    }

    // ─── Helpers ────────────────────────────────────────────────────────────

    private User resolveActor(ZenoPrincipal principal) {
        if (principal == null) return null;
        return userRepository.findByUsername(principal.getUsername()).orElse(null);
    }
}

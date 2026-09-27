package com.zeno.api.dashboard;

import com.zeno.api.common.security.ZenoPrincipal;
import com.zeno.api.refill.BlockerType;
import com.zeno.api.refill.RefillPriority;
import com.zeno.api.refill.RefillRequest;
import com.zeno.api.refill.RefillRequestRepository;
import com.zeno.api.refill.RefillStatus;
import com.zeno.api.resolution.ResolutionCaseRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Dashboard API — provides aggregate metrics and case queues for the operations dashboard.
 *
 * All data is scoped to the authenticated user's organization.
 */
@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final RefillRequestRepository refillRepository;
    private final ResolutionCaseRepository caseRepository;

    @GetMapping("/summary")
    public ResponseEntity<Map<String, Object>> getSummary(
            @AuthenticationPrincipal ZenoPrincipal principal) {

        Long orgId = principal != null ? principal.getOrganizationId() : null;

        Map<String, Object> summary = new HashMap<>();

        if (orgId != null) {
            summary.put("totalActive", refillRepository.countByStatusAndOrganizationId(RefillStatus.REQUESTED, orgId)
                    + refillRepository.countByStatusAndOrganizationId(RefillStatus.UNDER_REVIEW, orgId)
                    + refillRepository.countByStatusAndOrganizationId(RefillStatus.BLOCKED, orgId)
                    + refillRepository.countByStatusAndOrganizationId(RefillStatus.ACTION_REQUIRED, orgId)
                    + refillRepository.countByStatusAndOrganizationId(RefillStatus.AWAITING_PROVIDER, orgId)
                    + refillRepository.countByStatusAndOrganizationId(RefillStatus.AWAITING_PRACTICE, orgId)
                    + refillRepository.countByStatusAndOrganizationId(RefillStatus.AWAITING_PHARMACY, orgId)
                    + refillRepository.countByStatusAndOrganizationId(RefillStatus.AWAITING_INSURANCE, orgId));

            summary.put("awaitingProvider",
                    refillRepository.countByStatusAndOrganizationId(RefillStatus.AWAITING_PROVIDER, orgId));
            summary.put("awaitingPharmacy",
                    refillRepository.countByStatusAndOrganizationId(RefillStatus.AWAITING_PHARMACY, orgId));
            summary.put("awaitingInsurance",
                    refillRepository.countByStatusAndOrganizationId(RefillStatus.AWAITING_INSURANCE, orgId));
            summary.put("ready",
                    refillRepository.countByStatusAndOrganizationId(RefillStatus.READY, orgId));
            summary.put("escalated",
                    refillRepository.countByStatusAndOrganizationId(RefillStatus.ESCALATED, orgId));
            summary.put("activeCases",
                    caseRepository.countActiveByOrganizationId(orgId));

            // Blocker breakdown
            Map<String, Long> blockers = new HashMap<>();
            for (BlockerType bt : BlockerType.values()) {
                blockers.put(bt.name(), refillRepository.countActiveByBlockerTypeAndOrganizationId(bt, orgId));
            }
            summary.put("blockerBreakdown", blockers);
        } else {
            // Admin — global counts
            summary.put("totalActive", refillRepository.count());
        }

        return ResponseEntity.ok(summary);
    }

    @GetMapping("/refills")
    public ResponseEntity<List<DashboardRefillItem>> getRefillQueue(
            @AuthenticationPrincipal ZenoPrincipal principal) {

        Long orgId = principal != null ? principal.getOrganizationId() : null;
        List<RefillRequest> refills;

        if (orgId != null) {
            refills = refillRepository.findActiveByOrganizationId(orgId);
        } else {
            refills = refillRepository.findAll();
        }

        List<DashboardRefillItem> items = refills.stream()
                .map(DashboardRefillItem::from)
                .collect(Collectors.toList());

        return ResponseEntity.ok(items);
    }

    @GetMapping("/blockers")
    public ResponseEntity<List<DashboardRefillItem>> getBlockedRefills(
            @AuthenticationPrincipal ZenoPrincipal principal) {

        Long orgId = principal != null ? principal.getOrganizationId() : null;
        List<RefillRequest> blocked;

        if (orgId != null) {
            blocked = refillRepository.findActiveByOrganizationId(orgId).stream()
                    .filter(r -> r.getBlockerType() != null)
                    .collect(Collectors.toList());
        } else {
            blocked = refillRepository.findAll().stream()
                    .filter(r -> r.getBlockerType() != null)
                    .collect(Collectors.toList());
        }

        return ResponseEntity.ok(blocked.stream()
                .map(DashboardRefillItem::from)
                .collect(Collectors.toList()));
    }
}

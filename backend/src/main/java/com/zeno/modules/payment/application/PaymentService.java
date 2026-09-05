package com.zeno.modules.payment.application;

import com.zeno.modules.customer.domain.Customer;
import com.zeno.modules.customer.domain.CustomerRepository;
import com.zeno.modules.payment.domain.Payment;
import com.zeno.modules.payment.domain.PaymentRepository;
import com.zeno.modules.payment.interfaces.dto.TransactionSummaryResponse;
import com.zeno.modules.refund.domain.Refund;
import com.zeno.modules.refund.domain.RefundRepository;
import com.zeno.modules.risk.domain.RiskAssessment;
import com.zeno.modules.risk.domain.RiskAssessmentRepository;
import com.zeno.modules.risk.domain.RiskSignalRepository;
import com.zeno.shared.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class PaymentService {

    private final PaymentRepository        paymentRepository;
    private final RefundRepository         refundRepository;
    private final RiskAssessmentRepository riskAssessmentRepository;
    private final RiskSignalRepository     riskSignalRepository;
    private final CustomerRepository       customerRepository;

    // ─────────────────────────────────────────────────────────────────────────
    // List — enriched with refund, risk, and customer data
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Returns a paginated list of transaction summaries enriched with
     * refund status, risk scores, and customer display names.
     *
     * - search:     case-insensitive contains on externalPaymentId (server-side)
     * - riskLevel:  post-filter applied after risk aggregation (in-memory)
     * - customerId: filter to a specific customer (for the customer-detail tab)
     */
    @Transactional(readOnly = true)
    public Page<TransactionSummaryResponse> listPayments(
            UUID merchantId, String search, String riskLevel, UUID customerId, Pageable pageable) {

        // ── 1. Payment page ───────────────────────────────────────────────────
        boolean hasSearch     = search != null && !search.isBlank();
        boolean hasCustomerId = customerId != null;

        Page<Payment> page;
        if (hasCustomerId) {
            page = paymentRepository.findByMerchantIdAndCustomerId(merchantId, customerId, pageable);
        } else if (hasSearch) {
            page = paymentRepository.findByMerchantIdAndExternalPaymentIdContainingIgnoreCase(
                    merchantId, search.trim(), pageable);
        } else {
            page = paymentRepository.findByMerchantId(merchantId, pageable);
        }

        if (page.isEmpty()) {
            return new PageImpl<>(List.of(), pageable, 0);
        }

        List<Payment> payments = page.getContent();

        // ── 1. Refunds by paymentId ───────────────────────────────────────────
        List<UUID> paymentIds = payments.stream().map(Payment::getId).toList();
        Map<UUID, Refund> refundByPaymentId = new HashMap<>();
        try {
            refundRepository.findAllByMerchantIdAndPaymentIdIn(merchantId, paymentIds)
                    .forEach(r -> refundByPaymentId.put(r.getPaymentId(), r));
        } catch (Exception ex) {
            log.warn("Refund bulk fetch failed: {}", ex.getMessage());
        }

        // ── 2. Latest risk assessment per customer (bulk across merchant) ─────
        List<UUID> customerIds = payments.stream()
                .map(Payment::getCustomerId).distinct().toList();
        Map<UUID, RiskAssessment> riskByCustomerId = new HashMap<>();
        try {
            riskAssessmentRepository.latestRiskPerCustomerForMerchant(merchantId)
                    .forEach(row -> {
                        UUID cid = (UUID) row[0];
                        if (customerIds.contains(cid)) {
                            // reconstruct a lightweight object from the projection
                            // row: [customerId, riskScore, riskLevel]
                            riskByCustomerId.put(cid, buildAssessmentProjection(row));
                        }
                    });
        } catch (Exception ex) {
            log.warn("Risk bulk fetch failed: {}", ex.getMessage());
        }

        // ── 3. Signal counts for those assessment IDs ─────────────────────────
        // We need assessment IDs first — the latestRisk query above only gives
        // score/level projections, not IDs. Fetch IDs for the customer IDs we have.
        Map<UUID, Integer> signalCountByCustomerId = new HashMap<>();
        try {
            List<UUID> assessmentIds = new ArrayList<>();
            Map<UUID, UUID> assessmentIdByCustomerId = new HashMap<>();
            for (UUID cid : customerIds) {
                riskAssessmentRepository
                        .findTopByMerchantIdAndCustomerIdOrderByCreatedAtDesc(merchantId, cid)
                        .ifPresent(a -> {
                            assessmentIds.add(a.getId());
                            assessmentIdByCustomerId.put(cid, a.getId());
                        });
            }
            if (!assessmentIds.isEmpty()) {
                riskSignalRepository.countByAssessmentIdIn(assessmentIds)
                        .forEach(row -> {
                            UUID asmId = (UUID) row[0];
                            int  count = ((Number) row[1]).intValue();
                            // reverse-map assessmentId → customerId
                            assessmentIdByCustomerId.forEach((cid, aid) -> {
                                if (aid.equals(asmId)) signalCountByCustomerId.put(cid, count);
                            });
                        });
            }
        } catch (Exception ex) {
            log.warn("Signal count bulk fetch failed: {}", ex.getMessage());
        }

        // ── 4. Customer display names ─────────────────────────────────────────
        Map<UUID, String> nameByCustomerId = new HashMap<>();
        try {
            customerRepository.findAllByMerchantIdAndIdIn(merchantId, customerIds)
                    .forEach(c -> nameByCustomerId.put(c.getId(), deriveName(c.getExternalCustomerId())));
        } catch (Exception ex) {
            log.warn("Customer name bulk fetch failed: {}", ex.getMessage());
        }

        // ── 5. Assemble (+ optional riskLevel post-filter) ───────────────────
        boolean filterByRisk = riskLevel != null && !riskLevel.isBlank()
                && !riskLevel.equalsIgnoreCase("ALL");

        List<TransactionSummaryResponse> summaries = payments.stream()
                .map(p -> TransactionSummaryResponse.from(
                        p,
                        nameByCustomerId.get(p.getCustomerId()),
                        refundByPaymentId.get(p.getId()),
                        riskByCustomerId.get(p.getCustomerId()),
                        signalCountByCustomerId.getOrDefault(p.getCustomerId(), 0)
                ))
                .filter(t -> !filterByRisk ||
                        (t.riskLevel() != null && t.riskLevel().equalsIgnoreCase(riskLevel)))
                .toList();

        long total = filterByRisk ? summaries.size() : page.getTotalElements();
        return new PageImpl<>(summaries, pageable, total);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Single payment — enriched
    // ─────────────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public TransactionSummaryResponse getPayment(UUID merchantId, UUID paymentId) {
        Payment payment = paymentRepository.findByMerchantIdAndId(merchantId, paymentId)
                .orElseThrow(() -> new ResourceNotFoundException("Payment", paymentId));

        // Refund
        Refund refund = null;
        try {
            List<Refund> refunds = refundRepository.findAllByMerchantIdAndPaymentIdIn(
                    merchantId, List.of(paymentId));
            if (!refunds.isEmpty()) refund = refunds.get(0);
        } catch (Exception ex) {
            log.warn("Refund fetch failed for payment {}: {}", paymentId, ex.getMessage());
        }

        // Risk assessment + signal count
        RiskAssessment assessment = null;
        int sigCount = 0;
        try {
            Optional<RiskAssessment> oa = riskAssessmentRepository
                    .findTopByMerchantIdAndCustomerIdOrderByCreatedAtDesc(merchantId, payment.getCustomerId());
            if (oa.isPresent()) {
                assessment = oa.get();
                sigCount = (int) riskSignalRepository
                        .findAllByAssessmentId(assessment.getId()).size();
            }
        } catch (Exception ex) {
            log.warn("Risk fetch failed for payment {}: {}", paymentId, ex.getMessage());
        }

        // Customer name
        String customerName = null;
        try {
            customerName = customerRepository
                    .findByMerchantIdAndId(merchantId, payment.getCustomerId())
                    .map(c -> deriveName(c.getExternalCustomerId()))
                    .orElse(null);
        } catch (Exception ex) {
            log.warn("Customer fetch failed for payment {}: {}", paymentId, ex.getMessage());
        }

        return TransactionSummaryResponse.from(payment, customerName, refund, assessment, sigCount);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

    /** Build a minimal RiskAssessment shell from a JPQL projection row. */
    private RiskAssessment buildAssessmentProjection(Object[] row) {
        // row: [customerId, riskScore, riskLevel]
        RiskAssessment a = new RiskAssessment();
        a.setRiskScore(((Number) row[1]).intValue());
        a.setRiskLevel((com.zeno.modules.risk.domain.RiskLevel) row[2]);
        return a;
    }

    /** Strips prefix and returns a short readable display name from externalCustomerId. */
    private static String deriveName(String externalId) {
        if (externalId == null || externalId.isBlank()) return "Unknown";
        String stripped = externalId.replaceFirst("(?i)^(EXT|CUST|USR|USER|CID)[_\\-]", "");
        if (stripped.matches("[0-9A-Fa-f]{8,}")) {
            stripped = stripped.substring(0, 8).toUpperCase();
        }
        return stripped.toUpperCase();
    }
}

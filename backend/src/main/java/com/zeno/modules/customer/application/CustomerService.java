package com.zeno.modules.customer.application;

import com.zeno.modules.customer.domain.Customer;
import com.zeno.modules.customer.domain.CustomerRepository;
import com.zeno.modules.customer.domain.CustomerStatus;
import com.zeno.modules.customer.interfaces.dto.CustomerResponse;
import com.zeno.modules.customer.interfaces.dto.CustomerSummaryResponse;
import com.zeno.modules.payment.domain.PaymentRepository;
import com.zeno.modules.refund.domain.RefundRepository;
import com.zeno.modules.risk.domain.RiskAssessmentRepository;
import com.zeno.modules.risk.domain.RiskLevel;
import com.zeno.shared.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class CustomerService {

    private final CustomerRepository       customerRepository;
    private final PaymentRepository        paymentRepository;
    private final RefundRepository         refundRepository;
    private final RiskAssessmentRepository riskAssessmentRepository;

    // ─────────────────────────────────────────────────────────────────────────
    // List (enriched summary)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Returns a paginated list of customer summaries enriched with aggregated
     * payment, refund, and risk data.
     *
     * - search: case-insensitive contains match on externalCustomerId (server-side)
     * - riskLevel: post-filter applied after risk aggregation (in-memory, no N+1)
     * - status: server-side CustomerStatus filter
     *
     * Total DB round-trips: 4 (1 customer page + 3 bulk aggregates).
     */
    @Transactional(readOnly = true)
    public Page<CustomerSummaryResponse> listCustomers(
            UUID merchantId, CustomerStatus status, String search, String riskLevel, Pageable pageable) {

        // ── 1. Fetch customer page (with optional search filter) ──────────────
        Page<Customer> page;
        boolean hasSearch = search != null && !search.isBlank();
        if (hasSearch) {
            page = customerRepository
                    .findByMerchantIdAndExternalCustomerIdContainingIgnoreCase(merchantId, search.trim(), pageable);
        } else if (status != null) {
            page = customerRepository.findByMerchantIdAndStatus(merchantId, status, pageable);
        } else {
            page = customerRepository.findByMerchantId(merchantId, pageable);
        }

        if (page.isEmpty()) {
            return new PageImpl<>(List.of(), pageable, 0);
        }

        // ── 2. Bulk-fetch payment aggregates for the whole merchant ───────────
        Map<UUID, Object[]> paymentAgg = new HashMap<>();
        try {
            for (Object[] row : paymentRepository.aggregateByCustomerForMerchant(merchantId)) {
                paymentAgg.put((UUID) row[0], row);
            }
        } catch (Exception ex) {
            log.warn("Payment aggregation failed — defaulting to zeros: {}", ex.getMessage());
        }

        // ── 3. Bulk-fetch refund counts for the whole merchant ────────────────
        Map<UUID, Long> refundCounts = new HashMap<>();
        try {
            for (Object[] row : refundRepository.countByCustomerForMerchant(merchantId)) {
                refundCounts.put((UUID) row[0], ((Number) row[1]).longValue());
            }
        } catch (Exception ex) {
            log.warn("Refund aggregation failed — defaulting to zeros: {}", ex.getMessage());
        }

        // ── 4. Bulk-fetch latest risk assessments for the whole merchant ──────
        Map<UUID, Object[]> riskAgg = new HashMap<>();
        try {
            for (Object[] row : riskAssessmentRepository.latestRiskPerCustomerForMerchant(merchantId)) {
                riskAgg.put((UUID) row[0], row);
            }
        } catch (Exception ex) {
            log.warn("Risk aggregation failed — defaulting to nulls: {}", ex.getMessage());
        }

        // ── 5. Assemble summaries (+ optional riskLevel post-filter) ──────────
        boolean filterByRisk = riskLevel != null && !riskLevel.isBlank() && !riskLevel.equalsIgnoreCase("ALL");

        List<CustomerSummaryResponse> summaries = page.getContent().stream()
                .map(customer -> {
                    UUID cid = customer.getId();

                    Object[] pRow     = paymentAgg.get(cid);
                    long     txnCount = pRow != null ? ((Number)    pRow[1]).longValue() : 0L;
                    BigDecimal totAmt = pRow != null ? (BigDecimal) pRow[2]              : BigDecimal.ZERO;
                    Instant  lastPay  = pRow != null ? (Instant)    pRow[3]             : null;
                    long     devCount = pRow != null ? ((Number)    pRow[4]).longValue() : 0L;
                    long     ipCnt    = pRow != null ? ((Number)    pRow[5]).longValue() : 0L;

                    long      refCount   = refundCounts.getOrDefault(cid, 0L);
                    Object[]  rRow       = riskAgg.get(cid);
                    Integer   riskScore  = rRow != null ? (Integer)   rRow[1]            : null;
                    RiskLevel custRisk   = rRow != null ? (RiskLevel) rRow[2]            : null;

                    return CustomerSummaryResponse.from(
                            customer, txnCount, totAmt, lastPay,
                            devCount, ipCnt, refCount, riskScore, custRisk);
                })
                // riskLevel post-filter (applied after enrichment so we have the level)
                .filter(s -> !filterByRisk ||
                        (s.riskLevel() != null && s.riskLevel().equalsIgnoreCase(riskLevel)))
                .toList();

        // Recalculate total after post-filter (approximate — filtered count may differ from page total)
        long total = filterByRisk ? summaries.size() : page.getTotalElements();
        return new PageImpl<>(summaries, pageable, total);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Single customer (plain DTO — used by detail views)
    // ─────────────────────────────────────────────────────────────────────────

    // ─────────────────────────────────────────────────────────────────────────
    // Single customer (enriched summary — used by detail view)
    // ─────────────────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public CustomerSummaryResponse getCustomer(UUID merchantId, UUID customerId) {
        Customer customer = customerRepository.findByMerchantIdAndId(merchantId, customerId)
                .orElseThrow(() -> new ResourceNotFoundException("Customer", customerId));

        // Payment aggregates for this single customer
        long       txnCount = 0L;
        BigDecimal totalAmt = BigDecimal.ZERO;
        Instant    lastPay  = null;
        long       devCount = 0L;
        long       ipCnt    = 0L;
        try {
            List<Object[]> rows = paymentRepository.aggregateByCustomerForMerchant(merchantId);
            for (Object[] row : rows) {
                if (customerId.equals(row[0])) {
                    txnCount = ((Number) row[1]).longValue();
                    totalAmt = (BigDecimal) row[2];
                    lastPay  = (Instant)   row[3];
                    devCount = ((Number)   row[4]).longValue();
                    ipCnt    = ((Number)   row[5]).longValue();
                    break;
                }
            }
        } catch (Exception ex) {
            log.warn("Payment aggregation failed for customer {}: {}", customerId, ex.getMessage());
        }

        // Refund count
        long refCount = 0L;
        try {
            refCount = refundRepository.countByMerchantIdAndCustomerId(merchantId, customerId);
        } catch (Exception ex) {
            log.warn("Refund count failed for customer {}: {}", customerId, ex.getMessage());
        }

        // Latest risk assessment
        Integer   riskScore = null;
        RiskLevel riskLevel = null;
        try {
            var assessment = riskAssessmentRepository
                    .findTopByMerchantIdAndCustomerIdOrderByCreatedAtDesc(merchantId, customerId);
            if (assessment.isPresent()) {
                riskScore = assessment.get().getRiskScore();
                riskLevel = assessment.get().getRiskLevel();
            }
        } catch (Exception ex) {
            log.warn("Risk lookup failed for customer {}: {}", customerId, ex.getMessage());
        }

        return CustomerSummaryResponse.from(
                customer, txnCount, totalAmt, lastPay,
                devCount, ipCnt, refCount, riskScore, riskLevel);
    }
}

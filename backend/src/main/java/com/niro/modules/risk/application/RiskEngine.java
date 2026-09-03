package com.niro.modules.risk.application;

import com.niro.modules.customer.domain.Customer;
import com.niro.modules.customer.domain.CustomerRepository;
import com.niro.modules.payment.domain.Payment;
import com.niro.modules.payment.infrastructure.JpaPaymentRepository;
import com.niro.modules.refund.infrastructure.JpaRefundRepository;
import com.niro.modules.risk.application.detector.RiskContext;
import com.niro.modules.risk.application.detector.RiskSignal;
import com.niro.modules.risk.application.detector.RiskSignalDetector;
import com.niro.modules.risk.domain.*;
import com.niro.modules.risk.infrastructure.JpaRiskAssessmentRepository;
import com.niro.modules.risk.infrastructure.JpaRiskSignalRepository;
import com.niro.modules.risk.interfaces.dto.RiskAssessmentResponse;
import com.niro.shared.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class RiskEngine {

    private final List<RiskSignalDetector> detectors;
    private final RiskScoreCalculator scoreCalculator;
    private final JpaRiskAssessmentRepository assessmentRepository;
    private final JpaRiskSignalRepository signalRepository;
    private final CustomerRepository customerRepository;
    private final JpaPaymentRepository paymentRepository;
    private final JpaRefundRepository refundRepository;

    @Transactional
    public RiskAssessmentResponse analyzeCustomer(UUID merchantId, UUID customerId) {
        Customer customer = customerRepository.findByMerchantIdAndId(merchantId, customerId)
                .orElseThrow(() -> new ResourceNotFoundException("Customer", customerId));
        RiskContext ctx = buildContext(merchantId, customer);
        return runAndPersist(merchantId, ctx);
    }

    @Transactional
    public List<RiskAssessmentResponse> analyzeAllCustomers(UUID merchantId) {
        List<Customer> customers = customerRepository.findAllByMerchantId(merchantId);
        if (customers.isEmpty()) {
            throw new ResourceNotFoundException("No customers found. Please generate a dataset first.");
        }

        log.info("Starting risk scan for merchant {} — {} customers", merchantId, customers.size());

        signalRepository.deleteAllByMerchantId(merchantId);
        assessmentRepository.deleteAllByMerchantId(merchantId);

        List<RiskAssessmentResponse> results = new ArrayList<>();
        for (Customer customer : customers) {
            try {
                RiskContext ctx = buildContext(merchantId, customer);
                results.add(runAndPersist(merchantId, ctx));
            } catch (Exception ex) {
                log.warn("Failed to assess customer {}: {}", customer.getId(), ex.getMessage());
            }
        }

        log.info("Risk scan complete for merchant {} — {} assessments", merchantId, results.size());
        return results;
    }

    @Transactional(readOnly = true)
    public Page<RiskAssessmentResponse> listAssessments(UUID merchantId, RiskLevel level, Pageable pageable) {
        Page<RiskAssessment> page = (level != null)
                ? assessmentRepository.findByMerchantIdAndRiskLevel(merchantId, level, pageable)
                : assessmentRepository.findByMerchantId(merchantId, pageable);
        return page.map(a -> toResponse(a, signalRepository.findAllByAssessmentId(a.getId())));
    }

    @Transactional(readOnly = true)
    public RiskAssessmentResponse getAssessment(UUID merchantId, UUID assessmentId) {
        RiskAssessment assessment = assessmentRepository.findById(assessmentId)
                .filter(a -> a.getMerchantId().equals(merchantId))
                .orElseThrow(() -> new ResourceNotFoundException("RiskAssessment", assessmentId));
        return toResponse(assessment, signalRepository.findAllByAssessmentId(assessmentId));
    }

    private RiskContext buildContext(UUID merchantId, Customer customer) {
        List<Payment> customerPayments = paymentRepository
                .findAllByMerchantIdAndCustomerId(merchantId, customer.getId());
        var customerRefunds = refundRepository
                .findAllByMerchantIdAndCustomerId(merchantId, customer.getId());

        Set<String> devices = customerPayments.stream()
                .map(Payment::getDeviceId).filter(Objects::nonNull).collect(Collectors.toSet());
        Set<String> ips = customerPayments.stream()
                .map(Payment::getIpAddress).filter(Objects::nonNull).collect(Collectors.toSet());

        List<Payment> sharedDevicePayments = devices.stream()
                .flatMap(d -> paymentRepository.findByMerchantIdAndDeviceId(merchantId, d).stream())
                .collect(Collectors.toList());
        List<Payment> sharedIpPayments = ips.stream()
                .flatMap(ip -> paymentRepository.findByMerchantIdAndIpAddress(merchantId, ip).stream())
                .collect(Collectors.toList());

        long totalPayments = paymentRepository.countByMerchantId(merchantId);
        long totalRefunds  = refundRepository.findAllByMerchantId(merchantId).size();
        double baseline = totalPayments > 0 ? (double) totalRefunds / totalPayments : 0.05;

        return RiskContext.builder()
                .merchantId(merchantId)
                .customer(customer)
                .customerPayments(customerPayments)
                .customerRefunds(customerRefunds)
                .sharedDevicePayments(sharedDevicePayments)
                .sharedIpPayments(sharedIpPayments)
                .merchantBaselineRefundRate(baseline)
                .build();
    }

    private RiskAssessmentResponse runAndPersist(UUID merchantId, RiskContext ctx) {
        List<RiskSignal> signals = detectors.stream()
                .map(d -> d.detect(ctx))
                .filter(Optional::isPresent)
                .map(Optional::get)
                .collect(Collectors.toList());

        int score = scoreCalculator.calculateScore(signals);
        RiskLevel level = scoreCalculator.calculateLevel(score);

        RiskAssessment assessment = RiskAssessment.builder()
                .merchantId(merchantId)
                .customerId(ctx.getCustomer().getId())
                .riskScore(score)
                .riskLevel(level)
                .signalCount(signals.size())
                .flagged(level == RiskLevel.HIGH || level == RiskLevel.CRITICAL)
                .build();
        assessment = assessmentRepository.save(assessment);

        UUID assessmentId = assessment.getId();
        List<RiskSignalEntity> signalEntities = signals.stream()
                .map(s -> RiskSignalEntity.builder()
                        .assessmentId(assessmentId)
                        .merchantId(merchantId)
                        .signalType(s.getSignalType())
                        .observedValue(s.getObservedValue())
                        .baselineValue(s.getBaselineValue())
                        .scoreContribution(s.getScoreContribution())
                        .severity(s.getSeverity())
                        .explanation(s.getExplanation())
                        .build())
                .collect(Collectors.toList());
        signalRepository.saveAll(signalEntities);

        return toResponse(assessment, signalEntities);
    }

    private RiskAssessmentResponse toResponse(RiskAssessment a, List<RiskSignalEntity> signals) {
        return RiskAssessmentResponse.from(a, signals);
    }
}

package com.zeno.modules.intelligence.application;

import com.zeno.modules.intelligence.domain.AiAssessmentEntity;
import com.zeno.modules.intelligence.domain.AiAssessmentRepository;
import com.zeno.modules.intelligence.interfaces.dto.AiAssessmentResponse;
import com.zeno.modules.intelligence.interfaces.dto.AssessEvidenceRequest;
import com.zeno.modules.payment.infrastructure.JpaPaymentRepository;
import com.zeno.modules.refund.infrastructure.JpaRefundRepository;
import com.zeno.modules.risk.domain.RiskAssessmentRepository;
import com.zeno.modules.risk.domain.RiskSignalEntity;
import com.zeno.modules.risk.domain.RiskSignalRepository;
import com.zeno.modules.risk.domain.SignalType;
import com.zeno.shared.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class IntelligenceService {

    private final IntelligenceProvider intelligenceProvider;
    private final AiAssessmentRepository assessmentRepository;
    private final RiskAssessmentRepository riskAssessmentRepository;
    private final RiskSignalRepository riskSignalRepository;
    private final JpaPaymentRepository paymentRepository;
    private final JpaRefundRepository refundRepository;

    @Transactional
    public AiAssessmentResponse assessCustomer(UUID merchantId, AssessEvidenceRequest request) {
        // Fetch latest risk assessment for this subject
        var riskAssessment = riskAssessmentRepository
                .findTopByMerchantIdAndCustomerIdOrderByCreatedAtDesc(merchantId, request.subjectId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "No risk assessment found for subject. Run risk analysis first."));

        List<RiskSignalEntity> signals = riskSignalRepository.findAllByAssessmentId(riskAssessment.getId());

        // Build evidence bundle from observable data only
        var payments = paymentRepository.findAllByMerchantIdAndCustomerId(merchantId, request.subjectId());
        var refunds  = refundRepository.findAllByMerchantIdAndCustomerId(merchantId, request.subjectId());

        Instant window24h = Instant.now().minus(24, ChronoUnit.HOURS);
        long velocityLast24h = payments.stream()
                .filter(p -> p.getTimestamp().isAfter(window24h))
                .count();

        long totalMerchantPayments = paymentRepository.countByMerchantId(merchantId);
        long totalMerchantRefunds  = refundRepository.findAllByMerchantId(merchantId).size();
        double baseline = totalMerchantPayments > 0 ? (double) totalMerchantRefunds / totalMerchantPayments : 0.05;

        double refundRate = payments.isEmpty() ? 0 : (double) refunds.size() / payments.size();

        // Shared device/IP counts from signals
        int sharedDeviceCount = signals.stream()
                .filter(s -> s.getSignalType() == SignalType.DEVICE_REUSE)
                .mapToInt(s -> s.getObservedValue() != null ? (int) Math.round(s.getObservedValue()) : 0)
                .sum();
        int sharedIpCount = signals.stream()
                .filter(s -> s.getSignalType() == SignalType.IP_REUSE)
                .mapToInt(s -> s.getObservedValue() != null ? (int) Math.round(s.getObservedValue()) : 0)
                .sum();

        BigDecimal exposure = refunds.stream()
                .map(r -> r.getAmount())
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        EvidenceBundle bundle = EvidenceBundle.builder()
                .merchantId(merchantId)
                .subjectType(request.subjectType())
                .subjectId(request.subjectId())
                .riskScore(riskAssessment.getRiskScore())
                .riskLevel(riskAssessment.getRiskLevel())
                .triggeredSignals(signals.stream().map(RiskSignalEntity::getSignalType).toList())
                .refundRate(refundRate)
                .merchantBaselineRefundRate(baseline)
                .transactionCount(payments.size())
                .refundCount(refunds.size())
                .sharedDeviceCount(sharedDeviceCount)
                .sharedIpCount(sharedIpCount)
                .velocityLast24h((int) velocityLast24h)
                .clusterSize(request.clusterSize() != null ? request.clusterSize() : 1)
                .estimatedExposure(exposure)
                .signalExplanations(signals.stream().map(RiskSignalEntity::getExplanation).toList())
                // ML fields — populated when ML service was enabled during risk analysis
                .fraudProbability(riskAssessment.getFraudProbability())
                .anomalyScore(riskAssessment.getAnomalyScore())
                .modelVersion(riskAssessment.getModelVersion())
                .shapContributions(null) // SHAP contributions stored in ml_predictions; not yet fetched here
                .build();

        AiAssessment assessment = intelligenceProvider.assess(bundle);

        // Persist the assessment
        AiAssessmentEntity entity = AiAssessmentEntity.builder()
                .merchantId(merchantId)
                .subjectType(request.subjectType())
                .subjectId(request.subjectId())
                .assessmentType(assessment.assessmentType())
                .confidence(assessment.confidence())
                .reasons(assessment.reasons())
                .recommendedAction(assessment.recommendedAction())
                .provider(assessment.provider())
                .promptSummary("Evidence bundle for " + request.subjectType() + " " + request.subjectId()
                        + " | riskScore=" + riskAssessment.getRiskScore()
                        + " | signals=" + signals.size())
                .build();
        entity = assessmentRepository.save(entity);

        log.info("AI assessment for {} {}: {} (confidence={}, provider={})",
                request.subjectType(), request.subjectId(),
                assessment.assessmentType(), assessment.confidence(), assessment.provider());

        return AiAssessmentResponse.from(entity);
    }
}

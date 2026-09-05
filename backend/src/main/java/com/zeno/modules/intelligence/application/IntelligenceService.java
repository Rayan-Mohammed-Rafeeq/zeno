package com.zeno.modules.intelligence.application;

import com.zeno.modules.graph.domain.ClusterMember;
import com.zeno.modules.graph.domain.NodeType;
import com.zeno.modules.graph.domain.RiskCluster;
import com.zeno.modules.graph.infrastructure.JpaClusterMemberRepository;
import com.zeno.modules.graph.infrastructure.JpaRiskClusterRepository;
import com.zeno.modules.intelligence.domain.AiAssessmentEntity;
import com.zeno.modules.intelligence.domain.AiAssessmentRepository;
import com.zeno.modules.intelligence.interfaces.dto.AiAssessmentResponse;
import com.zeno.modules.intelligence.interfaces.dto.AssessEvidenceRequest;
import com.zeno.modules.intelligence.interfaces.dto.ChargebackEvidenceRequest;
import com.zeno.modules.intelligence.interfaces.dto.ChargebackEvidenceResponse;
import com.zeno.modules.ml.domain.MlPrediction;
import com.zeno.modules.ml.domain.MlPredictionRepository;
import com.zeno.modules.payment.infrastructure.JpaPaymentRepository;
import com.zeno.modules.refund.infrastructure.JpaRefundRepository;
import com.zeno.modules.risk.domain.RiskAssessment;
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
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

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
    private final MlPredictionRepository mlPredictionRepository;
    private final JpaClusterMemberRepository clusterMemberRepository;
    private final JpaRiskClusterRepository riskClusterRepository;

    @Transactional
    public AiAssessmentResponse assessCustomer(UUID merchantId, AssessEvidenceRequest request) {
        // ── 1. Fetch latest risk assessment ──────────────────────────────
        var riskAssessment = riskAssessmentRepository
                .findTopByMerchantIdAndCustomerIdOrderByCreatedAtDesc(merchantId, request.subjectId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "No risk assessment found for subject. Run risk analysis first."));

        List<RiskSignalEntity> signals = riskSignalRepository.findAllByAssessmentId(riskAssessment.getId());

        // ── 2. Payment + refund data ──────────────────────────────────────
        var payments = paymentRepository.findAllByMerchantIdAndCustomerId(merchantId, request.subjectId());
        var refunds  = refundRepository.findAllByMerchantIdAndCustomerId(merchantId, request.subjectId());

        Instant window24h = Instant.now().minus(24, ChronoUnit.HOURS);
        long velocityLast24h = payments.stream()
                .filter(p -> p.getTimestamp().isAfter(window24h))
                .count();

        long totalMerchantPayments = paymentRepository.countByMerchantId(merchantId);
        long totalMerchantRefunds  = refundRepository.findAllByMerchantId(merchantId).size();
        double baseline = totalMerchantPayments > 0
                ? (double) totalMerchantRefunds / totalMerchantPayments : 0.05;

        double refundRate = payments.isEmpty() ? 0 : (double) refunds.size() / payments.size();

        // ── 3. Shared device / IP from signals ────────────────────────────
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

        // ── 4. SHAP contributions from ml_predictions ─────────────────────
        List<String> shapContributions = null;
        Optional<MlPrediction> latestPrediction = mlPredictionRepository
                .findTopByMerchantIdAndCustomerIdOrderByCreatedAtDesc(merchantId, request.subjectId());

        if (latestPrediction.isPresent() && latestPrediction.get().getFeatureContributions() != null) {
            shapContributions = latestPrediction.get().getFeatureContributions().stream()
                    .sorted((a, b) -> Integer.compare(a.rank(), b.rank()))
                    .limit(6)
                    .map(fc -> {
                        String sign = fc.shapValue() >= 0 ? "+" : "";
                        return fc.feature() + " (" + sign + String.format("%.3f", fc.shapValue()) + ")";
                    })
                    .collect(Collectors.toList());
            log.debug("SHAP contributions wired for customer {}: {} entries", request.subjectId(),
                    shapContributions.size());
        }

        // ── 5. Graph / cluster evidence ───────────────────────────────────
        int clusterSize = request.clusterSize() != null ? request.clusterSize() : 1;
        String clusterRelationshipSummary = null;
        int connectedHighRiskCount = 0;

        List<ClusterMember> customerMemberships = clusterMemberRepository
                .findAllByEntityId(request.subjectId());

        if (!customerMemberships.isEmpty()) {
            UUID clusterId = customerMemberships.get(0).getClusterId();
            List<ClusterMember> clusterMembers = clusterMemberRepository.findAllByClusterId(clusterId);
            clusterSize = clusterMembers.size();

            Optional<RiskCluster> cluster = riskClusterRepository
                    .findByMerchantIdAndId(merchantId, clusterId);
            if (cluster.isPresent()) {
                clusterRelationshipSummary = String.format(
                        "Member of cluster %s with %d entities; cluster risk score %d (%s)",
                        clusterId.toString().substring(0, 8),
                        clusterSize,
                        cluster.get().getRiskScore(),
                        cluster.get().getRiskLevel());
                // Count other members as connected high-risk entities
                connectedHighRiskCount = clusterSize - 1;
            }
        }

        // ── 6. Enriched signal details ────────────────────────────────────
        List<EvidenceBundle.SignalDetail> signalDetails = signals.stream()
                .map(s -> EvidenceBundle.SignalDetail.builder()
                        .signalName(s.getSignalType().name().replace('_', ' '))
                        .signalType(s.getSignalType().name())
                        .severity(s.getSeverity().name())
                        .observedValue(s.getObservedValue() != null ? s.getObservedValue() : 0.0)
                        .baselineValue(s.getBaselineValue() != null ? s.getBaselineValue() : 0.0)
                        .scoreContribution(s.getScoreContribution())
                        .explanation(s.getExplanation() != null ? s.getExplanation() : "")
                        .build())
                .collect(Collectors.toList());

        // ── 7. Build evidence bundle ──────────────────────────────────────
        EvidenceBundle bundle = EvidenceBundle.builder()
                .merchantId(merchantId)
                .subjectType(request.subjectType())
                .subjectId(request.subjectId())
                .riskScore(riskAssessment.getRiskScore())
                .riskLevel(riskAssessment.getRiskLevel())
                .triggeredSignals(signals.stream().map(RiskSignalEntity::getSignalType).toList())
                .signalDetails(signalDetails)
                .refundRate(refundRate)
                .merchantBaselineRefundRate(baseline)
                .transactionCount(payments.size())
                .refundCount(refunds.size())
                .sharedDeviceCount(sharedDeviceCount)
                .sharedIpCount(sharedIpCount)
                .velocityLast24h((int) velocityLast24h)
                .clusterSize(clusterSize)
                .estimatedExposure(exposure)
                .signalExplanations(signals.stream().map(RiskSignalEntity::getExplanation).toList())
                // ML — from risk_assessments (fraud probability, anomaly) + ml_predictions (SHAP)
                .fraudProbability(riskAssessment.getFraudProbability())
                .anomalyScore(riskAssessment.getAnomalyScore())
                .modelVersion(riskAssessment.getModelVersion())
                .shapContributions(shapContributions)
                // Graph evidence
                .connectedHighRiskCount(connectedHighRiskCount)
                .clusterRelationshipSummary(clusterRelationshipSummary)
                // Benchmark context (always available, non-fabricated)
                .benchmarkPrecision("61.6%")
                .benchmarkRecall("48.1%")
                .benchmarkAuprc("0.56")
                .build();

        // ── 8. AI assessment ──────────────────────────────────────────────
        AiAssessment assessment = intelligenceProvider.assess(bundle);

        // ── 9. Persist ────────────────────────────────────────────────────
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
                        + " | signals=" + signals.size()
                        + " | shapContribs=" + (shapContributions != null ? shapContributions.size() : 0)
                        + " | clusterSize=" + clusterSize)
                .structuredResult(assessment.structuredResult())
                .build();
        entity = assessmentRepository.save(entity);

        log.info("AI assessment for {} {}: {} (confidence={}, provider={}, shap={}, cluster={})",
                request.subjectType(), request.subjectId(),
                assessment.assessmentType(), assessment.confidence(), assessment.provider(),
                shapContributions != null ? shapContributions.size() : 0, clusterSize);

        return AiAssessmentResponse.from(entity);
    }

    // ─────────────────────────────────────────────────────────────────────
    // Chargeback evidence package
    // ─────────────────────────────────────────────────────────────────────

    /**
     * Assembles a defensive chargeback/dispute evidence package for a customer.
     *
     * Organizes existing observable evidence only — never invents facts.
     * The LLM may produce a concise summary, but all source data is from the DB.
     * Labeled as AI-generated and requires analyst verification.
     */
    @Transactional(readOnly = true)
    public ChargebackEvidenceResponse buildChargebackEvidence(UUID merchantId, ChargebackEvidenceRequest request) {
        String subjectType = request.subjectType() != null ? request.subjectType() : "CUSTOMER";

        // Risk assessment
        RiskAssessment riskAssessment = riskAssessmentRepository
                .findTopByMerchantIdAndCustomerIdOrderByCreatedAtDesc(merchantId, request.subjectId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "No risk assessment found. Run risk analysis first."));

        List<RiskSignalEntity> signals = riskSignalRepository.findAllByAssessmentId(riskAssessment.getId());

        // Transactions + refunds
        var payments = paymentRepository.findAllByMerchantIdAndCustomerId(merchantId, request.subjectId());
        var refunds  = refundRepository.findAllByMerchantIdAndCustomerId(merchantId, request.subjectId());

        double totalAmount = payments.stream()
                .filter(p -> p.getAmount() != null)
                .mapToDouble(p -> p.getAmount().doubleValue())
                .sum();
        double refundRate = payments.isEmpty() ? 0.0 : (double) refunds.size() / payments.size();

        long totalMerchantPayments = paymentRepository.countByMerchantId(merchantId);
        long totalMerchantRefunds  = refundRepository.findAllByMerchantId(merchantId).size();
        double baseline = totalMerchantPayments > 0
                ? (double) totalMerchantRefunds / totalMerchantPayments : 0.05;

        // Signal names
        List<String> signalNames = signals.stream()
                .map(s -> s.getSignalType().name().replace('_', ' '))
                .collect(Collectors.toList());

        // ML + SHAP
        Optional<MlPrediction> mlPred = mlPredictionRepository
                .findTopByMerchantIdAndCustomerIdOrderByCreatedAtDesc(merchantId, request.subjectId());

        Double fraudProbability = riskAssessment.getFraudProbability();
        String modelVersion     = riskAssessment.getModelVersion();
        List<String> shapDrivers = new ArrayList<>();

        if (mlPred.isPresent() && mlPred.get().getFeatureContributions() != null) {
            shapDrivers = mlPred.get().getFeatureContributions().stream()
                    .sorted((a, b) -> Integer.compare(a.rank(), b.rank()))
                    .limit(5)
                    .map(fc -> {
                        String sign = fc.shapValue() >= 0 ? "+" : "";
                        return fc.feature() + " (" + sign + String.format("%.3f", fc.shapValue()) + ")";
                    })
                    .collect(Collectors.toList());
        }

        // Cluster evidence
        int clusterSize = 1;
        String networkSummary = "No connected cluster detected for this customer.";

        List<ClusterMember> memberships = clusterMemberRepository.findAllByEntityId(request.subjectId());
        if (!memberships.isEmpty()) {
            UUID clusterId = memberships.get(0).getClusterId();
            List<ClusterMember> clusterMembers = clusterMemberRepository.findAllByClusterId(clusterId);
            clusterSize = clusterMembers.size();
            Optional<RiskCluster> cluster = riskClusterRepository
                    .findByMerchantIdAndId(merchantId, clusterId);
            if (cluster.isPresent()) {
                networkSummary = String.format(
                        "Customer is part of a %d-entity connected cluster (cluster risk score: %d, level: %s). " +
                        "Connected via shared device or IP fingerprints.",
                        clusterSize, cluster.get().getRiskScore(), cluster.get().getRiskLevel());
            }
        }

        // Case summary
        String caseSummary = buildChargebackCaseSummary(
                request.subjectId(), riskAssessment, refundRate, baseline,
                fraudProbability, clusterSize, signals.size());

        // Recommended action
        String action = riskAssessment.getRiskLevel().name().equals("CRITICAL") ? "PREPARE_CHARGEBACK_EVIDENCE"
                : riskAssessment.getRiskLevel().name().equals("HIGH") ? "HOLD_FOR_REVIEW"
                : "MANUAL_REVIEW";

        log.info("Chargeback evidence assembled for customer {}: riskScore={} signals={} cluster={}",
                request.subjectId(), riskAssessment.getRiskScore(), signals.size(), clusterSize);

        return ChargebackEvidenceResponse.of(
                request.subjectId(), subjectType, caseSummary,
                payments.size(), totalAmount, refunds.size(),
                refundRate, baseline,
                riskAssessment.getRiskScore(), riskAssessment.getRiskLevel().name(),
                signalNames, fraudProbability, modelVersion, shapDrivers,
                clusterSize, networkSummary, action
        );
    }

    private String buildChargebackCaseSummary(
            UUID subjectId, RiskAssessment riskAssessment,
            double refundRate, double baseline,
            Double fraudProbability, int clusterSize, int signalCount) {

        StringBuilder sb = new StringBuilder();
        sb.append("Customer ").append(subjectId.toString(), 0, 8).append("... ");
        sb.append("has a risk score of ").append(riskAssessment.getRiskScore()).append("/100 (")
          .append(riskAssessment.getRiskLevel()).append("). ");

        if (refundRate > baseline * 1.5) {
            sb.append(String.format("Refund rate of %.1f%% is %.1fx above merchant baseline of %.1f%%. ",
                    refundRate * 100, refundRate / baseline, baseline * 100));
        }

        if (clusterSize > 1) {
            sb.append("Customer is connected to ").append(clusterSize - 1)
              .append(" other entities in an abuse-ring cluster. ");
        }

        if (fraudProbability != null) {
            sb.append(String.format("ML model fraud probability: %.1f%%. ", fraudProbability * 100));
        }

        sb.append(signalCount).append(" risk signal(s) triggered. ");
        sb.append("Evidence assembled from Zeno risk database — analyst verification required.");

        return sb.toString();
    }
}

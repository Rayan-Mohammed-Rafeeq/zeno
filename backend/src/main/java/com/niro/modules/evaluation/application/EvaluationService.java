package com.niro.modules.evaluation.application;

import com.niro.config.NiroProperties;
import com.niro.modules.customer.domain.Customer;
import com.niro.modules.customer.domain.CustomerRepository;
import com.niro.modules.dataset.domain.DatasetRunRepository;
import com.niro.modules.dataset.domain.GroundTruthLabel;
import com.niro.modules.dataset.domain.GroundTruthLabelRepository;
import com.niro.modules.evaluation.domain.EvaluationRun;
import com.niro.modules.evaluation.domain.EvaluationRunRepository;
import com.niro.modules.evaluation.interfaces.dto.EvaluationMetricsResponse;
import com.niro.modules.evaluation.interfaces.dto.EvaluationRunResponse;
import com.niro.modules.evaluation.interfaces.dto.FalsePositiveCaseResponse;
import com.niro.modules.evaluation.interfaces.dto.SignalPerformanceResponse;
import com.niro.modules.risk.domain.*;
import com.niro.shared.exception.BusinessRuleException;
import com.niro.shared.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class EvaluationService {

    private final EvaluationRunRepository evaluationRunRepository;
    private final DatasetRunRepository datasetRunRepository;
    private final GroundTruthLabelRepository groundTruthLabelRepository;
    private final RiskAssessmentRepository riskAssessmentRepository;
    private final RiskSignalRepository riskSignalRepository;
    private final CustomerRepository customerRepository;
    private final MetricsCalculator metricsCalculator;
    private final NiroProperties properties;

    // ── Run evaluation ────────────────────────────────────────────────────

    /**
     * Runs evaluation against hidden ground truth labels.
     *
     * Flow:
     * 1. Load ground truth labels for the latest dataset run (positive = known abuse)
     * 2. Load detector predictions (risk assessments — HIGH/CRITICAL = predicted positive)
     * 3. Compare prediction vs truth per customer → confusion matrix
     * 4. Compute precision, recall, F1, FPR, FNR, FP cost
     *
     * Ground truth is ONLY read here — never in the risk detector.
     */
    @Transactional
    public EvaluationRunResponse runEvaluation(UUID merchantId) {
        var datasetRun = datasetRunRepository.findTopByMerchantIdOrderByCreatedAtDesc(merchantId)
                .orElseThrow(() -> new BusinessRuleException("NO_DATASET",
                        "No dataset found. Generate a dataset and run risk analysis first."));

        List<GroundTruthLabel> labels = groundTruthLabelRepository
                .findAllByDatasetRunId(datasetRun.getId())
                .stream()
                .filter(l -> "CUSTOMER".equals(l.getEntityType()))
                .collect(Collectors.toList());

        if (labels.isEmpty()) {
            throw new BusinessRuleException("NO_GROUND_TRUTH",
                    "No ground truth labels found for this dataset run.");
        }

        List<RiskAssessment> assessments = riskAssessmentRepository.findAllByMerchantId(merchantId);
        if (assessments.isEmpty()) {
            throw new BusinessRuleException("NO_ASSESSMENTS",
                    "No risk assessments found. Run risk analysis first.");
        }

        Map<UUID, RiskAssessment> latestByCustomer = buildLatestAssessmentMap(assessments);

        int tp = 0, tn = 0, fp = 0, fn = 0;
        for (GroundTruthLabel label : labels) {
            UUID customerId        = label.getEntityId();
            boolean gtPositive     = label.isPositive();
            RiskAssessment assess  = latestByCustomer.get(customerId);
            boolean predPositive   = assess != null &&
                    (assess.getRiskLevel() == RiskLevel.HIGH || assess.getRiskLevel() == RiskLevel.CRITICAL);

            if (gtPositive && predPositive)         tp++;
            else if (!gtPositive && !predPositive)  tn++;
            else if (!gtPositive && predPositive)   fp++;
            else                                    fn++;
        }

        ConfusionMatrix matrix   = new ConfusionMatrix(tp, tn, fp, fn);
        EvaluationMetrics metrics = metricsCalculator.compute(matrix);
        NiroProperties.Evaluation.FalsePositiveCost costs = properties.getEvaluation().getFalsePositiveCost();
        double fpCost = fp * (costs.getManualReviewCost() + costs.getHeldTransactionOpportunityCost());

        EvaluationRun run = EvaluationRun.builder()
                .merchantId(merchantId).datasetRunId(datasetRun.getId())
                .evaluatedAt(Instant.now()).sampleCount(labels.size())
                .truePositive(tp).trueNegative(tn).falsePositive(fp).falseNegative(fn)
                .precisionScore(metrics.precision()).recallScore(metrics.recall())
                .f1Score(metrics.f1()).falsePositiveRate(metrics.falsePositiveRate())
                .falseNegativeRate(metrics.falseNegativeRate()).falsePositiveCost(fpCost)
                .build();
        run = evaluationRunRepository.save(run);

        log.info("Evaluation complete for merchant {}: TP={} TN={} FP={} FN={} F1={} FPCost={}",
                merchantId, tp, tn, fp, fn, metrics.f1(), fpCost);

        return EvaluationRunResponse.from(run, costs);
    }

    @Transactional(readOnly = true)
    public EvaluationRunResponse getLatest(UUID merchantId) {
        EvaluationRun run = requireLatestRun(merchantId);
        return EvaluationRunResponse.from(run, properties.getEvaluation().getFalsePositiveCost());
    }

    // ── New endpoints matching frontend evaluationApi ─────────────────────

    /**
     * GET /evaluation/metrics
     * Flat aggregate metrics matching EvaluationMetrics TypeScript type.
     */
    @Transactional(readOnly = true)
    public EvaluationMetricsResponse getMetrics(UUID merchantId) {
        EvaluationRun run = requireLatestRun(merchantId);
        double fpCostPerCase = properties.getEvaluation().getFalsePositiveCost().getManualReviewCost()
                + properties.getEvaluation().getFalsePositiveCost().getHeldTransactionOpportunityCost();
        return EvaluationMetricsResponse.from(run, fpCostPerCase);
    }

    /**
     * GET /evaluation/signals
     * Per-signal precision, recall, FP count, and contribution percentage.
     *
     * Methodology:
     * For each signal type, find every assessment where that signal fired.
     * Compare against ground truth: if signal fired on a LEGITIMATE customer → FP for that signal.
     * Precision = TP_signal / (TP_signal + FP_signal).
     * Recall    = TP_signal / total_positive_cases.
     * Contribution = FP_signal / total_FP × 100.
     *
     * Ground truth is loaded here only for evaluation purposes.
     */
    @Transactional(readOnly = true)
    public List<SignalPerformanceResponse> getSignalPerformance(UUID merchantId) {
        var datasetRun = datasetRunRepository.findTopByMerchantIdOrderByCreatedAtDesc(merchantId)
                .orElse(null);
        if (datasetRun == null) return List.of();

        List<GroundTruthLabel> labels = groundTruthLabelRepository
                .findAllByDatasetRunId(datasetRun.getId())
                .stream().filter(l -> "CUSTOMER".equals(l.getEntityType()))
                .collect(Collectors.toList());
        if (labels.isEmpty()) return List.of();

        // ground truth map: customerId → isPositive
        Map<UUID, Boolean> gtMap = labels.stream()
                .collect(Collectors.toMap(GroundTruthLabel::getEntityId, GroundTruthLabel::isPositive));

        int totalPositives = (int) labels.stream().filter(GroundTruthLabel::isPositive).count();

        // Latest assessment per customer
        List<RiskAssessment> assessments = riskAssessmentRepository.findAllByMerchantId(merchantId);
        Map<UUID, RiskAssessment> latestByCustomer = buildLatestAssessmentMap(assessments);

        // For each signal: count TP and FP contributions
        Map<SignalType, int[]> signalStats = new LinkedHashMap<>(); // [tp, fp]
        for (SignalType st : SignalType.values()) {
            signalStats.put(st, new int[]{0, 0});
        }

        for (RiskAssessment assess : latestByCustomer.values()) {
            Boolean gt = gtMap.get(assess.getCustomerId());
            if (gt == null) continue;
            boolean predicted = assess.getRiskLevel() == RiskLevel.HIGH
                    || assess.getRiskLevel() == RiskLevel.CRITICAL;
            if (!predicted) continue;

            List<RiskSignalEntity> signals = riskSignalRepository.findAllByAssessmentId(assess.getId());
            for (RiskSignalEntity sig : signals) {
                int[] counts = signalStats.get(sig.getSignalType());
                if (counts == null) continue;
                if (gt) counts[0]++;  // TP
                else    counts[1]++;  // FP
            }
        }

        int totalFp = signalStats.values().stream().mapToInt(c -> c[1]).sum();

        return signalStats.entrySet().stream()
                .filter(e -> e.getValue()[0] + e.getValue()[1] > 0)
                .map(e -> {
                    int tp = e.getValue()[0];
                    int fp = e.getValue()[1];
                    double precision   = tp + fp > 0 ? (double) tp / (tp + fp) : 0.0;
                    double recall      = totalPositives > 0 ? (double) tp / totalPositives : 0.0;
                    double contribution = totalFp > 0 ? (double) fp / totalFp * 100.0 : 0.0;
                    return new SignalPerformanceResponse(
                            e.getKey().name(),
                            round(precision), round(recall), fp, round(contribution)
                    );
                })
                .sorted(Comparator.comparingDouble(SignalPerformanceResponse::contribution).reversed())
                .collect(Collectors.toList());
    }

    /**
     * GET /evaluation/false-positives
     * Error analysis: customers predicted HIGH/CRITICAL who are actually LEGITIMATE.
     *
     * Ground truth is read here only — never exposed to the risk detector.
     * Returns up to 20 examples with human-readable reasons derived from their signals.
     */
    @Transactional(readOnly = true)
    public List<FalsePositiveCaseResponse> getFalsePositives(UUID merchantId) {
        var datasetRun = datasetRunRepository.findTopByMerchantIdOrderByCreatedAtDesc(merchantId)
                .orElse(null);
        if (datasetRun == null) return List.of();

        Map<UUID, Boolean> gtMap = groundTruthLabelRepository
                .findAllByDatasetRunId(datasetRun.getId())
                .stream().filter(l -> "CUSTOMER".equals(l.getEntityType()))
                .collect(Collectors.toMap(GroundTruthLabel::getEntityId, GroundTruthLabel::isPositive));

        List<RiskAssessment> assessments = riskAssessmentRepository.findAllByMerchantId(merchantId);
        Map<UUID, RiskAssessment> latestByCustomer = buildLatestAssessmentMap(assessments);

        // Resolve customer info for display
        Map<UUID, Customer> customerMap = customerRepository.findAllByMerchantId(merchantId)
                .stream().collect(Collectors.toMap(Customer::getId, c -> c));

        List<FalsePositiveCaseResponse> result = new ArrayList<>();

        for (Map.Entry<UUID, RiskAssessment> entry : latestByCustomer.entrySet()) {
            UUID customerId    = entry.getKey();
            RiskAssessment assess = entry.getValue();
            Boolean gt         = gtMap.get(customerId);

            // False positive: predicted HIGH/CRITICAL but actually LEGITIMATE
            boolean predicted = assess.getRiskLevel() == RiskLevel.HIGH
                    || assess.getRiskLevel() == RiskLevel.CRITICAL;
            if (!predicted || gt == null || gt) continue;

            Customer customer = customerMap.get(customerId);
            String customerName = customer != null
                    ? "Customer-" + customer.getExternalCustomerId().substring(0, 8)
                    : "Unknown";

            List<RiskSignalEntity> signals = riskSignalRepository.findAllByAssessmentId(assess.getId());
            String reason = signals.isEmpty()
                    ? "Elevated risk score without specific signal triggers."
                    : signals.stream()
                        .map(s -> s.getSignalType().name().replace("_", " ").toLowerCase())
                        .collect(Collectors.joining(", ")) + " signals triggered on a legitimate customer.";

            result.add(new FalsePositiveCaseResponse(
                    assess.getId().toString(),
                    customerId.toString(),
                    customerName,
                    assess.getRiskScore(),
                    assess.getRiskLevel().name(),
                    "LEGITIMATE",
                    reason
            ));

            if (result.size() >= 20) break;
        }

        return result;
    }

    // ── Private helpers ───────────────────────────────────────────────────

    private EvaluationRun requireLatestRun(UUID merchantId) {
        return evaluationRunRepository
                .findTopByMerchantIdOrderByCreatedAtDesc(merchantId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "No evaluation run found. Run POST /api/v1/evaluation/run first."));
    }

    private Map<UUID, RiskAssessment> buildLatestAssessmentMap(List<RiskAssessment> assessments) {
        Map<UUID, RiskAssessment> map = new HashMap<>();
        for (RiskAssessment a : assessments) {
            map.merge(a.getCustomerId(), a,
                    (existing, incoming) -> incoming.getCreatedAt().isAfter(existing.getCreatedAt())
                            ? incoming : existing);
        }
        return map;
    }

    private double round(double v) {
        return Math.round(v * 10000.0) / 10000.0;
    }
}

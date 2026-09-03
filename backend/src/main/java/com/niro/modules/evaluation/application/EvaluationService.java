package com.niro.modules.evaluation.application;

import com.niro.config.NiroProperties;
import com.niro.modules.dataset.domain.DatasetRunRepository;
import com.niro.modules.dataset.domain.GroundTruthLabel;
import com.niro.modules.dataset.domain.GroundTruthLabelRepository;
import com.niro.modules.evaluation.domain.EvaluationRun;
import com.niro.modules.evaluation.domain.EvaluationRunRepository;
import com.niro.modules.evaluation.interfaces.dto.EvaluationRunResponse;
import com.niro.modules.risk.domain.RiskAssessment;
import com.niro.modules.risk.domain.RiskAssessmentRepository;
import com.niro.modules.risk.domain.RiskLevel;
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
    private final MetricsCalculator metricsCalculator;
    private final NiroProperties properties;

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
        // Load the latest dataset run
        var datasetRun = datasetRunRepository.findTopByMerchantIdOrderByCreatedAtDesc(merchantId)
                .orElseThrow(() -> new BusinessRuleException("NO_DATASET",
                        "No dataset found. Generate a dataset and run risk analysis first."));

        // Load ground truth — customer-level labels only
        List<GroundTruthLabel> labels = groundTruthLabelRepository
                .findAllByDatasetRunId(datasetRun.getId())
                .stream()
                .filter(l -> "CUSTOMER".equals(l.getEntityType()))
                .collect(Collectors.toList());

        if (labels.isEmpty()) {
            throw new BusinessRuleException("NO_GROUND_TRUTH",
                    "No ground truth labels found for this dataset run.");
        }

        // Load latest risk assessment per customer
        List<RiskAssessment> assessments = riskAssessmentRepository.findAllByMerchantId(merchantId);
        if (assessments.isEmpty()) {
            throw new BusinessRuleException("NO_ASSESSMENTS",
                    "No risk assessments found. Run risk analysis first.");
        }

        // Build lookup: customerId → latest assessment
        Map<UUID, RiskAssessment> latestByCustomer = new HashMap<>();
        for (RiskAssessment a : assessments) {
            latestByCustomer.merge(a.getCustomerId(), a,
                    (existing, incoming) -> incoming.getCreatedAt().isAfter(existing.getCreatedAt())
                            ? incoming : existing);
        }

        // Compare prediction vs ground truth per labelled customer
        int tp = 0, tn = 0, fp = 0, fn = 0;

        for (GroundTruthLabel label : labels) {
            UUID customerId = label.getEntityId();
            boolean groundTruthPositive = label.isPositive();

            // Predicted positive = HIGH or CRITICAL risk assessment
            RiskAssessment assessment = latestByCustomer.get(customerId);
            boolean predictedPositive = assessment != null &&
                    (assessment.getRiskLevel() == RiskLevel.HIGH ||
                     assessment.getRiskLevel() == RiskLevel.CRITICAL);

            if (groundTruthPositive && predictedPositive)  tp++;
            else if (!groundTruthPositive && !predictedPositive) tn++;
            else if (!groundTruthPositive && predictedPositive)  fp++;
            else if (groundTruthPositive && !predictedPositive)  fn++;
        }

        ConfusionMatrix matrix = new ConfusionMatrix(tp, tn, fp, fn);
        EvaluationMetrics metrics = metricsCalculator.compute(matrix);

        // False positive cost — configurable prototype assumptions, not real merchant loss
        NiroProperties.Evaluation.FalsePositiveCost costs =
                properties.getEvaluation().getFalsePositiveCost();
        double fpCost = fp * (costs.getManualReviewCost() + costs.getHeldTransactionOpportunityCost());

        EvaluationRun run = EvaluationRun.builder()
                .merchantId(merchantId)
                .datasetRunId(datasetRun.getId())
                .evaluatedAt(Instant.now())
                .sampleCount(labels.size())
                .truePositive(tp)
                .trueNegative(tn)
                .falsePositive(fp)
                .falseNegative(fn)
                .precisionScore(metrics.precision())
                .recallScore(metrics.recall())
                .f1Score(metrics.f1())
                .falsePositiveRate(metrics.falsePositiveRate())
                .falseNegativeRate(metrics.falseNegativeRate())
                .falsePositiveCost(fpCost)
                .build();
        run = evaluationRunRepository.save(run);

        log.info("Evaluation complete for merchant {}: TP={} TN={} FP={} FN={} F1={} FPCost={}",
                merchantId, tp, tn, fp, fn, metrics.f1(), fpCost);

        return EvaluationRunResponse.from(run, costs);
    }

    @Transactional(readOnly = true)
    public EvaluationRunResponse getLatest(UUID merchantId) {
        EvaluationRun run = evaluationRunRepository
                .findTopByMerchantIdOrderByCreatedAtDesc(merchantId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "No evaluation run found. Run POST /api/v1/evaluation/run first."));
        NiroProperties.Evaluation.FalsePositiveCost costs =
                properties.getEvaluation().getFalsePositiveCost();
        return EvaluationRunResponse.from(run, costs);
    }
}

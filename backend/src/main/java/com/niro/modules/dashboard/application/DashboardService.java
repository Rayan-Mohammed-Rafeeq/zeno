package com.niro.modules.dashboard.application;

import com.niro.modules.dashboard.interfaces.dto.DashboardResponse;
import com.niro.modules.evaluation.domain.EvaluationRun;
import com.niro.modules.evaluation.domain.EvaluationRunRepository;
import com.niro.modules.graph.domain.RiskCluster;
import com.niro.modules.graph.domain.RiskClusterRepository;
import com.niro.modules.investigation.domain.InvestigationRepository;
import com.niro.modules.investigation.domain.InvestigationStatus;
import com.niro.modules.payment.infrastructure.JpaPaymentRepository;
import com.niro.modules.risk.domain.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DashboardService {

    private static final String DISCLAIMER =
            "All data displayed is synthetic and generated for defensive evaluation purposes only. " +
            "Metrics are prototype scores and do not represent certified production fraud detection performance.";

    private final JpaPaymentRepository paymentRepository;
    private final RiskAssessmentRepository riskAssessmentRepository;
    private final RiskSignalRepository riskSignalRepository;
    private final RiskClusterRepository clusterRepository;
    private final InvestigationRepository investigationRepository;
    private final EvaluationRunRepository evaluationRunRepository;

    @Transactional(readOnly = true)
    public DashboardResponse getDashboard(UUID merchantId) {
        // --- counts ---
        long txCount       = paymentRepository.countByMerchantId(merchantId);
        long customerCount = riskAssessmentRepository.findAllByMerchantId(merchantId)
                .stream().map(RiskAssessment::getCustomerId).distinct().count();
        long highRisk      = riskAssessmentRepository.countByMerchantIdAndRiskLevelIn(
                merchantId, List.of(RiskLevel.HIGH, RiskLevel.CRITICAL));
        long clusters      = clusterRepository.countByMerchantId(merchantId);
        long openInvs      = investigationRepository.countByMerchantIdAndStatus(
                merchantId, InvestigationStatus.OPEN);

        // --- risk distribution ---
        Map<String, Long> riskDist = riskAssessmentRepository.findAllByMerchantId(merchantId)
                .stream()
                .collect(Collectors.groupingBy(
                        a -> a.getRiskLevel().name(),
                        Collectors.counting()));
        for (RiskLevel lvl : RiskLevel.values()) {
            riskDist.putIfAbsent(lvl.name(), 0L);
        }

        // --- top signals ---
        List<RiskAssessment> allAssessments = riskAssessmentRepository.findAllByMerchantId(merchantId);
        Map<String, Long> signalCounts = new LinkedHashMap<>();
        for (RiskAssessment a : allAssessments) {
            riskSignalRepository.findAllByAssessmentId(a.getId())
                    .forEach(s -> signalCounts.merge(s.getSignalType().name(), 1L, Long::sum));
        }
        List<DashboardResponse.TopSignalDto> topSignals = signalCounts.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .limit(5)
                .map(e -> new DashboardResponse.TopSignalDto(e.getKey(), e.getValue()))
                .toList();

        // --- recent clusters ---
        List<DashboardResponse.RecentClusterDto> recentClusters = clusterRepository
                .findByMerchantId(merchantId,
                        PageRequest.of(0, 5, Sort.by(Sort.Direction.DESC, "createdAt")))
                .stream()
                .map(c -> new DashboardResponse.RecentClusterDto(
                        c.getId(), c.getRiskLevel().name(), c.getMemberCount(), c.getRiskScore()))
                .toList();

        // --- recent investigations ---
        List<DashboardResponse.RecentInvestigationDto> recentInvs = investigationRepository
                .findByMerchantId(merchantId,
                        PageRequest.of(0, 5, Sort.by(Sort.Direction.DESC, "createdAt")))
                .stream()
                .map(i -> new DashboardResponse.RecentInvestigationDto(
                        i.getId(), i.getSubjectType().name(),
                        i.getStatus().name(), i.getRiskLevel().name()))
                .toList();

        // --- latest evaluation metrics ---
        Optional<EvaluationRun> latestEval = evaluationRunRepository
                .findTopByMerchantIdOrderByCreatedAtDesc(merchantId);

        return new DashboardResponse(
                txCount, customerCount, highRisk, clusters, openInvs,
                latestEval.map(EvaluationRun::getPrecisionScore).orElse(null),
                latestEval.map(EvaluationRun::getRecallScore).orElse(null),
                latestEval.map(EvaluationRun::getF1Score).orElse(null),
                latestEval.map(EvaluationRun::getFalsePositiveRate).orElse(null),
                riskDist, topSignals, recentClusters, recentInvs,
                DISCLAIMER
        );
    }
}

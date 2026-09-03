package com.niro.modules.dashboard.interfaces.dto;

import com.niro.modules.risk.domain.RiskLevel;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Aggregate dashboard data for the React frontend.
 * All metrics are based on synthetic data — not real merchant transactions.
 */
public record DashboardResponse(
        long transactionsAnalyzed,
        long customersAnalyzed,
        long highRiskCustomers,
        long suspiciousClusters,
        long openInvestigations,

        // Evaluation metrics from latest run (null if not yet run)
        Double precision,
        Double recall,
        Double f1,
        Double falsePositiveRate,

        Map<String, Long> riskDistribution,
        List<TopSignalDto> topSignals,
        List<RecentClusterDto> recentClusters,
        List<RecentInvestigationDto> recentInvestigations,

        String dataDisclaimer
) {
    public record TopSignalDto(String signalType, long count) {}

    public record RecentClusterDto(
            UUID id, String riskLevel, int memberCount, int riskScore) {}

    public record RecentInvestigationDto(
            UUID id, String subjectType, String status, String riskLevel) {}
}

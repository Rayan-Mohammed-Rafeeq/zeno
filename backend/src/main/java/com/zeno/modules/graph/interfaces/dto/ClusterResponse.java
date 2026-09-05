package com.zeno.modules.graph.interfaces.dto;

import com.zeno.modules.graph.domain.ClusterMember;
import com.zeno.modules.graph.domain.ClusterStatus;
import com.zeno.modules.graph.domain.RiskCluster;
import com.zeno.modules.risk.domain.RiskLevel;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Full cluster response with computed relationship counts.
 *
 * deviceCount, ipCount, transactionCount, refundCount are computed by GraphService
 * from payment data at query time so the frontend has all it needs without a
 * separate graph fetch just for the list/summary views.
 *
 * estimatedExposure = sum of refund amounts from cluster members (not confirmed fraud loss).
 */
public record ClusterResponse(
        UUID id,
        UUID merchantId,
        int riskScore,
        RiskLevel riskLevel,
        /** Number of customer members in this cluster */
        int memberCount,
        /** Distinct devices seen across all cluster members (from payments) */
        int deviceCount,
        /** Distinct IP addresses seen across all cluster members (from payments) */
        int ipCount,
        /** Total payment records across all cluster members */
        int transactionCount,
        /** Total refund records across all cluster members */
        int refundCount,
        /**
         * Sum of refund amounts associated with cluster members.
         * This is associated transaction value, NOT confirmed fraud loss.
         */
        BigDecimal estimatedExposure,
        ClusterStatus status,
        List<ClusterMemberDto> members,
        Instant createdAt
) {
    public record ClusterMemberDto(String entityType, UUID entityId) {}

    /** Convenience factory used when relationship counts are not pre-computed (e.g. detect phase). */
    public static ClusterResponse from(RiskCluster c, List<ClusterMember> members) {
        return from(c, members, 0, 0, 0, 0);
    }

    public static ClusterResponse from(
            RiskCluster c,
            List<ClusterMember> members,
            int deviceCount,
            int ipCount,
            int transactionCount,
            int refundCount) {
        List<ClusterMemberDto> memberDtos = members.stream()
                .map(m -> new ClusterMemberDto(m.getEntityType().name(), m.getEntityId()))
                .toList();
        return new ClusterResponse(
                c.getId(), c.getMerchantId(), c.getRiskScore(), c.getRiskLevel(),
                c.getMemberCount(),
                deviceCount, ipCount, transactionCount, refundCount,
                c.getEstimatedExposure(), c.getStatus(),
                memberDtos, c.getCreatedAt());
    }
}

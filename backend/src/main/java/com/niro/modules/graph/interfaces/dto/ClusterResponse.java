package com.niro.modules.graph.interfaces.dto;

import com.niro.modules.graph.domain.ClusterMember;
import com.niro.modules.graph.domain.ClusterStatus;
import com.niro.modules.graph.domain.RiskCluster;
import com.niro.modules.risk.domain.RiskLevel;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record ClusterResponse(
        UUID id,
        UUID merchantId,
        int riskScore,
        RiskLevel riskLevel,
        int memberCount,
        BigDecimal estimatedExposure,
        ClusterStatus status,
        List<ClusterMemberDto> members,
        Instant createdAt
) {
    public record ClusterMemberDto(String entityType, UUID entityId) {}

    public static ClusterResponse from(RiskCluster c, List<ClusterMember> members) {
        List<ClusterMemberDto> memberDtos = members.stream()
                .map(m -> new ClusterMemberDto(m.getEntityType().name(), m.getEntityId()))
                .toList();
        return new ClusterResponse(
                c.getId(), c.getMerchantId(), c.getRiskScore(), c.getRiskLevel(),
                c.getMemberCount(), c.getEstimatedExposure(), c.getStatus(),
                memberDtos, c.getCreatedAt());
    }
}

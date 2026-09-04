package com.zeno.modules.graph.application;

import com.zeno.modules.graph.domain.*;
import com.zeno.modules.graph.infrastructure.JpaClusterMemberRepository;
import com.zeno.modules.graph.infrastructure.JpaRiskClusterRepository;
import com.zeno.modules.graph.interfaces.dto.*;
import com.zeno.modules.payment.infrastructure.JpaPaymentRepository;
import com.zeno.modules.refund.infrastructure.JpaRefundRepository;
import com.zeno.modules.risk.domain.RiskAssessmentRepository;
import com.zeno.shared.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class GraphService {

    private final GraphBuilder graphBuilder;
    private final ClusterDetector clusterDetector;
    private final JpaRiskClusterRepository clusterRepository;
    private final JpaClusterMemberRepository memberRepository;
    private final JpaPaymentRepository paymentRepository;
    private final JpaRefundRepository refundRepository;
    private final RiskAssessmentRepository riskAssessmentRepository;

    @Transactional
    public List<ClusterResponse> detectClusters(UUID merchantId) {
        // Clear existing clusters for this merchant
        List<RiskCluster> existing = clusterRepository.findAllByMerchantId(merchantId);
        if (!existing.isEmpty()) {
            List<UUID> existingIds = existing.stream().map(RiskCluster::getId).collect(Collectors.toList());
            memberRepository.deleteAllByClusterIdIn(existingIds);
            clusterRepository.deleteAllByMerchantId(merchantId);
        }

        // Build graph and detect
        MerchantGraph graph = graphBuilder.build(merchantId);
        List<ClusterDetector.DetectedCluster> detected = clusterDetector.detect(merchantId, graph);

        List<ClusterResponse> responses = new ArrayList<>();
        for (ClusterDetector.DetectedCluster dc : detected) {
            // Estimate exposure from refunds of cluster members
            Set<UUID> customerIds = dc.customerNodeIds().stream()
                    .map(nodeId -> UUID.fromString(nodeId.replace("CUSTOMER::", "")))
                    .collect(Collectors.toSet());

            BigDecimal exposure = customerIds.stream()
                    .flatMap(cid -> refundRepository.findAllByMerchantIdAndCustomerId(merchantId, cid).stream())
                    .map(r -> r.getAmount())
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            RiskCluster cluster = RiskCluster.builder()
                    .merchantId(merchantId)
                    .riskScore(dc.avgRiskScore())
                    .riskLevel(dc.riskLevel())
                    .memberCount(customerIds.size())
                    .estimatedExposure(exposure)
                    .status(ClusterStatus.ACTIVE)
                    .build();
            cluster = clusterRepository.save(cluster);

            List<ClusterMember> members = new ArrayList<>();
            for (UUID customerId : customerIds) {
                members.add(ClusterMember.builder()
                        .clusterId(cluster.getId())
                        .entityType(NodeType.CUSTOMER)
                        .entityId(customerId)
                        .build());
            }
            memberRepository.saveAll(members);

            responses.add(ClusterResponse.from(cluster, members));
        }

        return responses;
    }

    @Transactional(readOnly = true)
    public Page<ClusterResponse> listClusters(UUID merchantId, Pageable pageable) {
        return clusterRepository.findByMerchantId(merchantId, pageable)
                .map(cluster -> {
                    List<ClusterMember> members = memberRepository.findAllByClusterId(cluster.getId());
                    return ClusterResponse.from(cluster, members);
                });
    }

    @Transactional(readOnly = true)
    public ClusterResponse getCluster(UUID merchantId, UUID clusterId) {
        RiskCluster cluster = clusterRepository.findByMerchantIdAndId(merchantId, clusterId)
                .orElseThrow(() -> new ResourceNotFoundException("RiskCluster", clusterId));
        List<ClusterMember> members = memberRepository.findAllByClusterId(clusterId);
        return ClusterResponse.from(cluster, members);
    }

    @Transactional(readOnly = true)
    public GraphResponse getClusterGraph(UUID merchantId, UUID clusterId) {
        RiskCluster cluster = clusterRepository.findByMerchantIdAndId(merchantId, clusterId)
                .orElseThrow(() -> new ResourceNotFoundException("RiskCluster", clusterId));

        List<ClusterMember> members = memberRepository.findAllByClusterId(clusterId);
        Set<UUID> customerIds = members.stream()
                .filter(m -> m.getEntityType() == NodeType.CUSTOMER)
                .map(ClusterMember::getEntityId)
                .collect(Collectors.toSet());

        // Build sub-graph for this cluster's customers
        List<GraphNodeDto> nodes = new ArrayList<>();
        List<GraphEdgeDto> edges = new ArrayList<>();
        Set<String> seenNodes = new HashSet<>();

        Map<UUID, List<com.zeno.modules.payment.domain.Payment>> paymentsByCustomer = customerIds.stream()
                .collect(Collectors.toMap(
                        cid -> cid,
                        cid -> paymentRepository.findAllByMerchantIdAndCustomerId(merchantId, cid)
                ));

        // Get risk scores for customers
        Map<UUID, Integer> riskScores = riskAssessmentRepository.findAllByMerchantId(merchantId)
                .stream()
                .filter(a -> customerIds.contains(a.getCustomerId()))
                .collect(Collectors.toMap(
                        a -> a.getCustomerId(),
                        a -> a.getRiskScore(),
                        Math::max));

        for (UUID customerId : customerIds) {
            String custNodeId = "CUSTOMER::" + customerId;
            if (seenNodes.add(custNodeId)) {
                int score = riskScores.getOrDefault(customerId, 0);
                nodes.add(new GraphNodeDto(custNodeId, NodeType.CUSTOMER.name(), "Customer",
                        Map.of("riskScore", score, "customerId", customerId.toString())));
            }

            List<com.zeno.modules.payment.domain.Payment> payments =
                    paymentsByCustomer.getOrDefault(customerId, List.of());

            Set<String> devices = new HashSet<>();
            Set<String> ips     = new HashSet<>();

            for (com.zeno.modules.payment.domain.Payment p : payments) {
                if (p.getDeviceId() != null && !p.getDeviceId().isBlank()) {
                    devices.add(p.getDeviceId());
                }
                if (p.getIpAddress() != null && !p.getIpAddress().isBlank()) {
                    ips.add(p.getIpAddress());
                }
            }

            for (String device : devices) {
                String devNodeId = "DEVICE::" + device;
                if (seenNodes.add(devNodeId)) {
                    nodes.add(new GraphNodeDto(devNodeId, NodeType.DEVICE.name(),
                            "Device: " + device.substring(0, Math.min(8, device.length())),
                            Map.of("deviceId", device)));
                }
                edges.add(new GraphEdgeDto(
                        custNodeId + "_" + devNodeId,
                        custNodeId, devNodeId, EdgeType.USED_DEVICE.name()));
            }

            for (String ip : ips) {
                String ipNodeId = "IP::" + ip;
                if (seenNodes.add(ipNodeId)) {
                    nodes.add(new GraphNodeDto(ipNodeId, NodeType.IP.name(), "IP: " + ip, Map.of("ip", ip)));
                }
                edges.add(new GraphEdgeDto(
                        custNodeId + "_" + ipNodeId,
                        custNodeId, ipNodeId, EdgeType.USED_IP.name()));
            }
        }

        return new GraphResponse(nodes, edges);
    }
}

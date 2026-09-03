package com.niro.modules.graph.application;

import com.niro.modules.graph.domain.NodeType;
import com.niro.modules.risk.domain.RiskAssessment;
import com.niro.modules.risk.domain.RiskAssessmentRepository;
import com.niro.modules.risk.domain.RiskLevel;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Detects suspicious clusters using connected-components analysis on the
 * in-memory relationship graph. A component is considered suspicious when
 * it contains ≥ 2 customers AND at least one has a HIGH or CRITICAL risk score.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ClusterDetector {

    private static final int MIN_CLUSTER_SIZE = 2;

    private final RiskAssessmentRepository riskAssessmentRepository;

    public List<DetectedCluster> detect(UUID merchantId, MerchantGraph graph) {
        // Load latest risk assessments to enrich cluster scoring
        Map<String, Integer> customerRiskScores = riskAssessmentRepository
                .findAllByMerchantId(merchantId).stream()
                .collect(Collectors.toMap(
                        a -> a.getCustomerId().toString(),
                        RiskAssessment::getRiskScore,
                        // Keep highest score if multiple assessments
                        Math::max));

        // Run connected components BFS — only on CUSTOMER nodes
        Map<String, Set<String>> adjacency = graph.getAdjacency();
        Set<String> customerNodeIds = graph.getNodes().stream()
                .filter(n -> n.getType() == NodeType.CUSTOMER)
                .map(GraphNode::getNodeId)
                .collect(Collectors.toSet());

        Set<String> visited = new HashSet<>();
        List<DetectedCluster> clusters = new ArrayList<>();

        for (String startNode : customerNodeIds) {
            if (visited.contains(startNode)) continue;

            // BFS
            Set<String> component = new LinkedHashSet<>();
            Queue<String> queue = new LinkedList<>();
            queue.add(startNode);
            visited.add(startNode);

            while (!queue.isEmpty()) {
                String current = queue.poll();
                component.add(current);

                Set<String> neighbors = adjacency.getOrDefault(current, Collections.emptySet());
                for (String neighbor : neighbors) {
                    // Only traverse through CUSTOMER or DEVICE/IP nodes to reach other customers
                    if (!visited.contains(neighbor)) {
                        visited.add(neighbor);
                        // If it's a device/IP node, expand through it to find connected customers
                        if (!neighbor.startsWith("CUSTOMER::")) {
                            // Add device/IP's neighbors (customers using the same device/IP)
                            Set<String> bridgedCustomers = adjacency.getOrDefault(neighbor, Collections.emptySet())
                                    .stream()
                                    .filter(n -> n.startsWith("CUSTOMER::"))
                                    .collect(Collectors.toSet());
                            for (String bc : bridgedCustomers) {
                                if (!visited.contains(bc)) {
                                    visited.add(bc);
                                    queue.add(bc);
                                }
                            }
                        } else {
                            queue.add(neighbor);
                        }
                    }
                }
            }

            // Extract only customer node IDs from the component
            Set<String> customerComponents = component.stream()
                    .filter(n -> n.startsWith("CUSTOMER::"))
                    .collect(Collectors.toSet());

            if (customerComponents.size() < MIN_CLUSTER_SIZE) continue;

            // Score the cluster: average of member risk scores
            int totalScore = customerComponents.stream()
                    .mapToInt(nodeId -> {
                        String custId = nodeId.replace("CUSTOMER::", "");
                        return customerRiskScores.getOrDefault(custId, 0);
                    })
                    .sum();
            int avgScore = totalScore / customerComponents.size();

            // Only create cluster if it has meaningful risk
            boolean hasHighRisk = customerComponents.stream().anyMatch(nodeId -> {
                String custId = nodeId.replace("CUSTOMER::", "");
                return customerRiskScores.getOrDefault(custId, 0) >= 40;
            });

            if (!hasHighRisk) continue;

            RiskLevel level = avgScore >= 90 ? RiskLevel.CRITICAL
                            : avgScore >= 70 ? RiskLevel.HIGH
                            : avgScore >= 40 ? RiskLevel.MEDIUM
                            : RiskLevel.LOW;

            clusters.add(new DetectedCluster(customerComponents, avgScore, level));
        }

        log.info("Cluster detection for merchant {}: {} suspicious clusters found from graph",
                merchantId, clusters.size());
        return clusters;
    }

    public record DetectedCluster(
            Set<String> customerNodeIds,
            int avgRiskScore,
            RiskLevel riskLevel
    ) {}
}

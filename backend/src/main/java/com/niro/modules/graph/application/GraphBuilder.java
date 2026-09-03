package com.niro.modules.graph.application;

import com.niro.modules.graph.domain.EdgeType;
import com.niro.modules.payment.domain.Payment;
import com.niro.modules.payment.infrastructure.JpaPaymentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Builds an in-memory relationship graph from PostgreSQL payment data.
 * Nodes: CUSTOMER, DEVICE, IP
 * Edges: CUSTOMER → DEVICE (USED_DEVICE), CUSTOMER → IP (USED_IP),
 *        CUSTOMER → CUSTOMER (SHARED_ATTRIBUTE when sharing device/IP)
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class GraphBuilder {

    private final JpaPaymentRepository paymentRepository;

    public MerchantGraph build(UUID merchantId) {
        List<Payment> allPayments = paymentRepository.findAllByMerchantId(merchantId);
        MerchantGraph graph = new MerchantGraph();

        if (allPayments.isEmpty()) return graph;

        // Index by customer
        Map<String, List<Payment>> byCustomer = allPayments.stream()
                .collect(Collectors.groupingBy(p -> p.getCustomerId().toString()));

        // Index by device → list of customers using it
        Map<String, Set<String>> deviceToCustomers = new HashMap<>();
        Map<String, Set<String>> ipToCustomers     = new HashMap<>();

        for (Map.Entry<String, List<Payment>> entry : byCustomer.entrySet()) {
            String customerId = entry.getKey();
            List<Payment> payments = entry.getValue();

            GraphNode customerNode = GraphNode.customer(customerId);
            graph.addNode(customerNode);

            for (Payment p : payments) {
                if (p.getDeviceId() != null && !p.getDeviceId().isBlank()) {
                    GraphNode deviceNode = GraphNode.device(p.getDeviceId());
                    graph.addNode(deviceNode);
                    graph.addEdge(new GraphEdge(customerNode.getNodeId(), deviceNode.getNodeId(), EdgeType.USED_DEVICE));
                    deviceToCustomers.computeIfAbsent(p.getDeviceId(), k -> new HashSet<>()).add(customerId);
                }
                if (p.getIpAddress() != null && !p.getIpAddress().isBlank()) {
                    GraphNode ipNode = GraphNode.ip(p.getIpAddress());
                    graph.addNode(ipNode);
                    graph.addEdge(new GraphEdge(customerNode.getNodeId(), ipNode.getNodeId(), EdgeType.USED_IP));
                    ipToCustomers.computeIfAbsent(p.getIpAddress(), k -> new HashSet<>()).add(customerId);
                }
            }
        }

        // Add SHARED_ATTRIBUTE edges between customers sharing a device
        for (Set<String> customers : deviceToCustomers.values()) {
            if (customers.size() > 1) {
                List<String> list = new ArrayList<>(customers);
                for (int i = 0; i < list.size(); i++) {
                    for (int j = i + 1; j < list.size(); j++) {
                        graph.addEdge(new GraphEdge(
                                "CUSTOMER::" + list.get(i),
                                "CUSTOMER::" + list.get(j),
                                EdgeType.SHARED_ATTRIBUTE));
                    }
                }
            }
        }

        // Add SHARED_ATTRIBUTE edges between customers sharing an IP
        for (Set<String> customers : ipToCustomers.values()) {
            if (customers.size() > 1) {
                List<String> list = new ArrayList<>(customers);
                for (int i = 0; i < list.size(); i++) {
                    for (int j = i + 1; j < list.size(); j++) {
                        graph.addEdge(new GraphEdge(
                                "CUSTOMER::" + list.get(i),
                                "CUSTOMER::" + list.get(j),
                                EdgeType.SHARED_ATTRIBUTE));
                    }
                }
            }
        }

        log.debug("Graph built for merchant {}: {} nodes, {} edges",
                merchantId, graph.getNodes().size(), graph.getEdges().size());
        return graph;
    }
}

package com.zeno.modules.graph.application;

import com.zeno.modules.graph.domain.NodeType;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * In-memory graph node. ID is a composite of type + entityId so nodes
 * are unambiguous across different entity types.
 */
@Getter
@RequiredArgsConstructor
@EqualsAndHashCode(of = "nodeId")
public class GraphNode {
    private final String nodeId;       // e.g. "CUSTOMER::uuid" or "DEVICE::fingerprint"
    private final NodeType type;
    private final String entityId;     // UUID string or fingerprint string
    private final String label;        // human-readable label for React Flow

    public static GraphNode customer(String customerId) {
        return new GraphNode("CUSTOMER::" + customerId, NodeType.CUSTOMER, customerId, "Customer");
    }

    public static GraphNode device(String deviceId) {
        return new GraphNode("DEVICE::" + deviceId, NodeType.DEVICE, deviceId,
                "Device: " + deviceId.substring(0, Math.min(8, deviceId.length())));
    }

    public static GraphNode ip(String ip) {
        return new GraphNode("IP::" + ip, NodeType.IP, ip, "IP: " + ip);
    }
}

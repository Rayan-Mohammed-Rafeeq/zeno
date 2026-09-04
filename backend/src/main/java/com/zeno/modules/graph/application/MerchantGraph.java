package com.zeno.modules.graph.application;

import java.util.*;

/**
 * In-memory adjacency structure for a single merchant's relationship graph.
 * Built from PostgreSQL data — no graph database required.
 */
public class MerchantGraph {

    private final Map<String, GraphNode> nodes = new LinkedHashMap<>();
    private final Set<GraphEdge> edges = new LinkedHashSet<>();
    private final Map<String, Set<String>> adjacency = new HashMap<>();

    public void addNode(GraphNode node) {
        nodes.put(node.getNodeId(), node);
        adjacency.computeIfAbsent(node.getNodeId(), k -> new HashSet<>());
    }

    public void addEdge(GraphEdge edge) {
        edges.add(edge);
        adjacency.computeIfAbsent(edge.getSourceId(), k -> new HashSet<>()).add(edge.getTargetId());
        adjacency.computeIfAbsent(edge.getTargetId(), k -> new HashSet<>()).add(edge.getSourceId());
    }

    public Collection<GraphNode> getNodes() {
        return Collections.unmodifiableCollection(nodes.values());
    }

    public Collection<GraphEdge> getEdges() {
        return Collections.unmodifiableCollection(edges);
    }

    public Map<String, Set<String>> getAdjacency() {
        return Collections.unmodifiableMap(adjacency);
    }

    public boolean hasNode(String nodeId) {
        return nodes.containsKey(nodeId);
    }
}

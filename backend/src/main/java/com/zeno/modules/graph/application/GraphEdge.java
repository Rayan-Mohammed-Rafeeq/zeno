package com.zeno.modules.graph.application;

import com.zeno.modules.graph.domain.EdgeType;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
@EqualsAndHashCode(of = {"sourceId", "targetId", "edgeType"})
public class GraphEdge {
    private final String sourceId;
    private final String targetId;
    private final EdgeType edgeType;
}

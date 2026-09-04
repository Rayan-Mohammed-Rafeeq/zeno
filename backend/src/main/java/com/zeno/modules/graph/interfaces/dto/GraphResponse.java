package com.zeno.modules.graph.interfaces.dto;

import java.util.List;

public record GraphResponse(List<GraphNodeDto> nodes, List<GraphEdgeDto> edges) {}

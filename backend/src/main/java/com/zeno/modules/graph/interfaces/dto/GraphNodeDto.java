package com.zeno.modules.graph.interfaces.dto;

import java.util.Map;

/**
 * React Flow compatible node DTO.
 */
public record GraphNodeDto(
        String id,
        String type,
        String label,
        Map<String, Object> data
) {}

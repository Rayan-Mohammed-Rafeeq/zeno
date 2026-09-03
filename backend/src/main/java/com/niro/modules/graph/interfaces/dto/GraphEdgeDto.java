package com.niro.modules.graph.interfaces.dto;

/**
 * React Flow compatible edge DTO.
 */
public record GraphEdgeDto(
        String id,
        String source,
        String target,
        String type
) {}

package com.zeno.modules.risk.domain;

import java.util.List;
import java.util.UUID;

public interface RiskSignalRepository {
    List<RiskSignalEntity> findAllByAssessmentId(UUID assessmentId);

    /**
     * Bulk signal count per assessment ID.
     * Returns [assessmentId, count] for a set of assessment IDs.
     */
    List<Object[]> countByAssessmentIdIn(List<UUID> assessmentIds);
}

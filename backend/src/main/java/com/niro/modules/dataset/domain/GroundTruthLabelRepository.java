package com.niro.modules.dataset.domain;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface GroundTruthLabelRepository {
    List<GroundTruthLabel> findAllByDatasetRunId(UUID datasetRunId);
    Optional<GroundTruthLabel> findByDatasetRunIdAndEntityTypeAndEntityId(
            UUID datasetRunId, String entityType, UUID entityId);
}

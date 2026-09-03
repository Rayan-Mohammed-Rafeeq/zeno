package com.niro.modules.dataset.infrastructure;

import com.niro.modules.dataset.domain.GroundTruthLabel;
import com.niro.modules.dataset.domain.GroundTruthLabelRepository;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface JpaGroundTruthLabelRepository extends JpaRepository<GroundTruthLabel, UUID>, GroundTruthLabelRepository {
    List<GroundTruthLabel> findAllByDatasetRunId(UUID datasetRunId);

    Optional<GroundTruthLabel> findByDatasetRunIdAndEntityTypeAndEntityId(
            UUID datasetRunId, String entityType, UUID entityId);

    @Modifying
    @Query("DELETE FROM GroundTruthLabel g WHERE g.datasetRunId = :datasetRunId")
    void deleteAllByDatasetRunId(UUID datasetRunId);

    @Modifying
    @Query("DELETE FROM GroundTruthLabel g WHERE g.merchantId = :merchantId")
    void deleteAllByMerchantId(UUID merchantId);
}

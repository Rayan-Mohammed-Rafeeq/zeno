package com.niro.modules.dataset.infrastructure;

import com.niro.modules.dataset.domain.DatasetRun;
import com.niro.modules.dataset.domain.DatasetRunRepository;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface JpaDatasetRunRepository extends JpaRepository<DatasetRun, UUID>, DatasetRunRepository {
    Optional<DatasetRun> findTopByMerchantIdOrderByCreatedAtDesc(UUID merchantId);
}

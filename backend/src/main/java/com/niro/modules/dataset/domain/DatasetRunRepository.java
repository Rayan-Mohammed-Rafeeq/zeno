package com.niro.modules.dataset.domain;

import java.util.Optional;
import java.util.UUID;

public interface DatasetRunRepository {
    DatasetRun save(DatasetRun run);
    Optional<DatasetRun> findById(UUID id);
    Optional<DatasetRun> findTopByMerchantIdOrderByCreatedAtDesc(UUID merchantId);
}

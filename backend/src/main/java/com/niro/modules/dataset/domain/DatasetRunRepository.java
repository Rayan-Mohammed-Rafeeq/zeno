package com.niro.modules.dataset.domain;

import java.util.Optional;
import java.util.UUID;

public interface DatasetRunRepository {
    // save() is provided by JpaRepository — no redeclaration needed
    Optional<DatasetRun> findById(UUID id);
    Optional<DatasetRun> findTopByMerchantIdOrderByCreatedAtDesc(UUID merchantId);
}

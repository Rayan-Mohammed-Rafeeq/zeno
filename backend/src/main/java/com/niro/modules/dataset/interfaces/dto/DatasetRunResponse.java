package com.niro.modules.dataset.interfaces.dto;

import com.niro.modules.dataset.domain.DatasetRun;
import com.niro.modules.dataset.domain.DatasetStatus;

import java.time.Instant;
import java.util.UUID;

public record DatasetRunResponse(
        UUID id,
        UUID merchantId,
        int recordCount,
        long seed,
        DatasetStatus status,
        Instant generatedAt,
        Instant createdAt
) {
    public static DatasetRunResponse from(DatasetRun r) {
        return new DatasetRunResponse(
                r.getId(), r.getMerchantId(), r.getRecordCount(),
                r.getSeed(), r.getStatus(), r.getGeneratedAt(), r.getCreatedAt());
    }
}

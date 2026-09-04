package com.zeno.modules.ml.domain;

import java.util.Optional;
import java.util.UUID;

public interface MlPredictionRepository {
    MlPrediction save(MlPrediction prediction);
    Optional<MlPrediction> findTopByMerchantIdAndCustomerIdOrderByCreatedAtDesc(
            UUID merchantId, UUID customerId);
}

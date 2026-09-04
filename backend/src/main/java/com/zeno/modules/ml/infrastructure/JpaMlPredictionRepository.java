package com.zeno.modules.ml.infrastructure;

import com.zeno.modules.ml.domain.MlPrediction;
import com.zeno.modules.ml.domain.MlPredictionRepository;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface JpaMlPredictionRepository
        extends JpaRepository<MlPrediction, UUID>, MlPredictionRepository {

    @Override
    Optional<MlPrediction> findTopByMerchantIdAndCustomerIdOrderByCreatedAtDesc(
            UUID merchantId, UUID customerId);
}

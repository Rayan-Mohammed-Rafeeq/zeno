package com.zeno.modules.evaluation.domain;

import java.util.Optional;
import java.util.UUID;

public interface EvaluationRunRepository {
    EvaluationRun save(EvaluationRun run);
    Optional<EvaluationRun> findTopByMerchantIdOrderByCreatedAtDesc(UUID merchantId);
    Optional<EvaluationRun> findById(UUID id);
}

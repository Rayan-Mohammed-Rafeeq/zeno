package com.zeno.modules.evaluation.infrastructure;

import com.zeno.modules.evaluation.domain.EvaluationRun;
import com.zeno.modules.evaluation.domain.EvaluationRunRepository;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface JpaEvaluationRunRepository extends JpaRepository<EvaluationRun, UUID>, EvaluationRunRepository {
    Optional<EvaluationRun> findTopByMerchantIdOrderByCreatedAtDesc(UUID merchantId);
}

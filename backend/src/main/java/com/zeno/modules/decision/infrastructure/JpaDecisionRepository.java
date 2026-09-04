package com.zeno.modules.decision.infrastructure;

import com.zeno.modules.decision.domain.DecisionRecommendation;
import com.zeno.modules.decision.domain.DecisionRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface JpaDecisionRepository extends JpaRepository<DecisionRecommendation, UUID>, DecisionRepository {
    Optional<DecisionRecommendation> findTopByMerchantIdAndSubjectIdOrderByCreatedAtDesc(UUID merchantId, UUID subjectId);
    Page<DecisionRecommendation> findByMerchantId(UUID merchantId, Pageable pageable);
    List<DecisionRecommendation> findAllByMerchantId(UUID merchantId);
}

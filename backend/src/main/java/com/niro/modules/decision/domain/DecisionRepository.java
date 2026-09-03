package com.niro.modules.decision.domain;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DecisionRepository {
    DecisionRecommendation save(DecisionRecommendation decision);
    Optional<DecisionRecommendation> findTopByMerchantIdAndSubjectIdOrderByCreatedAtDesc(UUID merchantId, UUID subjectId);
    Page<DecisionRecommendation> findByMerchantId(UUID merchantId, Pageable pageable);
    List<DecisionRecommendation> findAllByMerchantId(UUID merchantId);
}

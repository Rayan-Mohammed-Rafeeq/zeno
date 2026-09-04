package com.zeno.modules.intelligence.domain;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AiAssessmentRepository {
    AiAssessmentEntity save(AiAssessmentEntity entity);
    Optional<AiAssessmentEntity> findTopByMerchantIdAndSubjectIdOrderByCreatedAtDesc(UUID merchantId, UUID subjectId);
    List<AiAssessmentEntity> findAllByMerchantId(UUID merchantId);
}

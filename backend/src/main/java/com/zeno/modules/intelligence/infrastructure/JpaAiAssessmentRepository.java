package com.zeno.modules.intelligence.infrastructure;

import com.zeno.modules.intelligence.domain.AiAssessmentEntity;
import com.zeno.modules.intelligence.domain.AiAssessmentRepository;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface JpaAiAssessmentRepository extends JpaRepository<AiAssessmentEntity, UUID>, AiAssessmentRepository {
    Optional<AiAssessmentEntity> findTopByMerchantIdAndSubjectIdOrderByCreatedAtDesc(UUID merchantId, UUID subjectId);
    List<AiAssessmentEntity> findAllByMerchantId(UUID merchantId);
}

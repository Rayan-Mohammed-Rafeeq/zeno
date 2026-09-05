package com.zeno.modules.risk.infrastructure;

import com.zeno.modules.risk.domain.RiskSignalEntity;
import com.zeno.modules.risk.domain.RiskSignalRepository;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface JpaRiskSignalRepository extends JpaRepository<RiskSignalEntity, UUID>, RiskSignalRepository {
    List<RiskSignalEntity> findAllByAssessmentId(UUID assessmentId);

    @Query("""
            SELECT s.assessmentId, COUNT(s)
            FROM RiskSignalEntity s
            WHERE s.assessmentId IN :assessmentIds
            GROUP BY s.assessmentId
            """)
    List<Object[]> countByAssessmentIdIn(List<UUID> assessmentIds);

    @Modifying
    @Query("DELETE FROM RiskSignalEntity s WHERE s.merchantId = :merchantId")
    void deleteAllByMerchantId(UUID merchantId);
}

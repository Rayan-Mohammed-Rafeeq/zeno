package com.niro.modules.risk.infrastructure;

import com.niro.modules.risk.domain.RiskSignalEntity;
import com.niro.modules.risk.domain.RiskSignalRepository;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface JpaRiskSignalRepository extends JpaRepository<RiskSignalEntity, UUID>, RiskSignalRepository {
    List<RiskSignalEntity> findAllByAssessmentId(UUID assessmentId);

    @Modifying
    @Query("DELETE FROM RiskSignalEntity s WHERE s.merchantId = :merchantId")
    void deleteAllByMerchantId(UUID merchantId);
}

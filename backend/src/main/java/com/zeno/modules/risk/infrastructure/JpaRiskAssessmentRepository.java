package com.zeno.modules.risk.infrastructure;

import com.zeno.modules.risk.domain.RiskAssessment;
import com.zeno.modules.risk.domain.RiskAssessmentRepository;
import com.zeno.modules.risk.domain.RiskLevel;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface JpaRiskAssessmentRepository extends JpaRepository<RiskAssessment, UUID>, RiskAssessmentRepository {
    Optional<RiskAssessment> findTopByMerchantIdAndCustomerIdOrderByCreatedAtDesc(UUID merchantId, UUID customerId);
    Page<RiskAssessment> findByMerchantId(UUID merchantId, Pageable pageable);
    Page<RiskAssessment> findByMerchantIdAndRiskLevel(UUID merchantId, RiskLevel riskLevel, Pageable pageable);
    List<RiskAssessment> findAllByMerchantId(UUID merchantId);
    long countByMerchantIdAndRiskLevelIn(UUID merchantId, List<RiskLevel> levels);

    @Modifying
    @Query("DELETE FROM RiskAssessment r WHERE r.merchantId = :merchantId")
    void deleteAllByMerchantId(UUID merchantId);
}

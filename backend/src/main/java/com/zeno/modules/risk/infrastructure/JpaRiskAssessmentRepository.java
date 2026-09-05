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

    /**
     * Latest risk assessment per customer for a given merchant.
     * Uses a subquery to get only the most recent assessment per customer.
     * Returns [customerId, riskScore, riskLevel] in a single query.
     */
    @Query("""
            SELECT r.customerId, r.riskScore, r.riskLevel
            FROM RiskAssessment r
            WHERE r.merchantId = :merchantId
              AND r.createdAt = (
                  SELECT MAX(r2.createdAt)
                  FROM RiskAssessment r2
                  WHERE r2.merchantId = r.merchantId
                    AND r2.customerId = r.customerId
              )
            """)
    List<Object[]> latestRiskPerCustomerForMerchant(UUID merchantId);
}

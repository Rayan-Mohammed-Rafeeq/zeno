package com.niro.modules.risk.domain;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RiskAssessmentRepository {
    Optional<RiskAssessment> findTopByMerchantIdAndCustomerIdOrderByCreatedAtDesc(UUID merchantId, UUID customerId);
    Page<RiskAssessment> findByMerchantId(UUID merchantId, Pageable pageable);
    Page<RiskAssessment> findByMerchantIdAndRiskLevel(UUID merchantId, RiskLevel riskLevel, Pageable pageable);
    List<RiskAssessment> findAllByMerchantId(UUID merchantId);
    long countByMerchantIdAndRiskLevelIn(UUID merchantId, List<RiskLevel> levels);
}

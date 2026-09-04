package com.zeno.modules.investigation.infrastructure;

import com.zeno.modules.investigation.domain.Investigation;
import com.zeno.modules.investigation.domain.InvestigationRepository;
import com.zeno.modules.investigation.domain.InvestigationStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface JpaInvestigationRepository extends JpaRepository<Investigation, UUID>, InvestigationRepository {
    Optional<Investigation> findByMerchantIdAndId(UUID merchantId, UUID id);
    Page<Investigation> findByMerchantId(UUID merchantId, Pageable pageable);
    Page<Investigation> findByMerchantIdAndStatus(UUID merchantId, InvestigationStatus status, Pageable pageable);
    long countByMerchantIdAndStatus(UUID merchantId, InvestigationStatus status);
}

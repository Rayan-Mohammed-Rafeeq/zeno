package com.zeno.modules.investigation.domain;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.Optional;
import java.util.UUID;

public interface InvestigationRepository {
    Investigation save(Investigation investigation);
    Optional<Investigation> findById(UUID id);
    Optional<Investigation> findByMerchantIdAndId(UUID merchantId, UUID id);
    Page<Investigation> findByMerchantId(UUID merchantId, Pageable pageable);
    Page<Investigation> findByMerchantIdAndStatus(UUID merchantId, InvestigationStatus status, Pageable pageable);
    long countByMerchantIdAndStatus(UUID merchantId, InvestigationStatus status);
}

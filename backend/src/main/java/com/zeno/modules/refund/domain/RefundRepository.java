package com.zeno.modules.refund.domain;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RefundRepository {
    Optional<Refund> findByMerchantIdAndId(UUID merchantId, UUID id);
    Page<Refund> findByMerchantId(UUID merchantId, Pageable pageable);
    List<Refund> findAllByMerchantIdAndCustomerId(UUID merchantId, UUID customerId);
    List<Refund> findAllByMerchantIdAndPaymentId(UUID merchantId, UUID paymentId);
    List<Refund> findAllByMerchantId(UUID merchantId);
    long countByMerchantIdAndCustomerId(UUID merchantId, UUID customerId);
}

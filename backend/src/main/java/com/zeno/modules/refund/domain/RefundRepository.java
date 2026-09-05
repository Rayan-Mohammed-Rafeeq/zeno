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
    /** Idempotency check — returns existing refund by Razorpay refund ID. */
    java.util.Optional<Refund> findByMerchantIdAndExternalRefundId(UUID merchantId, String externalRefundId);
    /**
     * Bulk refund count per customer for a given merchant.
     * Returns [customerId, refundCount] in a single query.
     */
    List<Object[]> countByCustomerForMerchant(UUID merchantId);

    /**
     * Fetch refunds for a specific set of payment IDs in one query.
     * Used to build a paymentId → Refund map for the transaction list.
     */
    List<Refund> findAllByMerchantIdAndPaymentIdIn(UUID merchantId, List<UUID> paymentIds);
}

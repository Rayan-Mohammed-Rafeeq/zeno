package com.zeno.modules.payment.domain;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PaymentRepository {
    Optional<Payment> findByMerchantIdAndId(UUID merchantId, UUID id);
    Page<Payment> findByMerchantId(UUID merchantId, Pageable pageable);
    List<Payment> findAllByMerchantIdAndCustomerId(UUID merchantId, UUID customerId);
    List<Payment> findAllByMerchantId(UUID merchantId);
    long countByMerchantId(UUID merchantId);
    long countByMerchantIdAndCustomerIdAndTimestampBetween(UUID merchantId, UUID customerId, Instant from, Instant to);
    long countByMerchantIdAndDeviceId(UUID merchantId, String deviceId);
    long countByMerchantIdAndIpAddress(UUID merchantId, String ipAddress);
    List<Payment> findByMerchantIdAndDeviceId(UUID merchantId, String deviceId);
    List<Payment> findByMerchantIdAndIpAddress(UUID merchantId, String ipAddress);
    /** Idempotency check — returns an existing payment by Razorpay payment ID. */
    Optional<Payment> findByMerchantIdAndExternalPaymentId(UUID merchantId, String externalPaymentId);
    /**
     * Bulk aggregation: returns one row per customer with
     * [customerId, txnCount, totalAmount, lastPaymentAt, deviceCount, ipCount].
     */
    List<Object[]> aggregateByCustomerForMerchant(UUID merchantId);
    /** Search by externalPaymentId (case-insensitive contains). */
    Page<Payment> findByMerchantIdAndExternalPaymentIdContainingIgnoreCase(
            UUID merchantId, String search, Pageable pageable);
    /** Filter by a specific customerId. */
    Page<Payment> findByMerchantIdAndCustomerId(UUID merchantId, UUID customerId, Pageable pageable);
}

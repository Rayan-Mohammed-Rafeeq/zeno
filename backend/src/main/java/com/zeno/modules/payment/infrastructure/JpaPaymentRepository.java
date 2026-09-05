package com.zeno.modules.payment.infrastructure;

import com.zeno.modules.payment.domain.Payment;
import com.zeno.modules.payment.domain.PaymentRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface JpaPaymentRepository extends JpaRepository<Payment, UUID>, PaymentRepository {
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

    @Modifying
    @Query("DELETE FROM Payment p WHERE p.merchantId = :merchantId")
    void deleteAllByMerchantId(UUID merchantId);

    /**
     * Bulk payment aggregation per customer for a given merchant.
     * Returns [customerId, txnCount, totalAmount, lastPaymentAt, deviceCount, ipCount]
     * using a single query to avoid N+1 when building the customer summary list.
     */
    @Query("""
            SELECT p.customerId,
                   COUNT(p),
                   COALESCE(SUM(p.amount), 0),
                   MAX(p.timestamp),
                   COUNT(DISTINCT p.deviceId),
                   COUNT(DISTINCT p.ipAddress)
            FROM Payment p
            WHERE p.merchantId = :merchantId
            GROUP BY p.customerId
            """)
    List<Object[]> aggregateByCustomerForMerchant(UUID merchantId);

    /** Search by externalPaymentId (case-insensitive contains). */
    Page<Payment> findByMerchantIdAndExternalPaymentIdContainingIgnoreCase(
            UUID merchantId, String search, Pageable pageable);

    /** Filter by a specific customerId (for customer-detail transaction tab). */
    Page<Payment> findByMerchantIdAndCustomerId(UUID merchantId, UUID customerId, Pageable pageable);
}

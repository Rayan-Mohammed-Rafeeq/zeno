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
}

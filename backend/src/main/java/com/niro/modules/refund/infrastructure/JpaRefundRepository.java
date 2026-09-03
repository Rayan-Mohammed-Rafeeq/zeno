package com.niro.modules.refund.infrastructure;

import com.niro.modules.refund.domain.Refund;
import com.niro.modules.refund.domain.RefundRepository;
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
public interface JpaRefundRepository extends JpaRepository<Refund, UUID>, RefundRepository {
    Optional<Refund> findByMerchantIdAndId(UUID merchantId, UUID id);
    Page<Refund> findByMerchantId(UUID merchantId, Pageable pageable);
    List<Refund> findAllByMerchantIdAndCustomerId(UUID merchantId, UUID customerId);
    List<Refund> findAllByMerchantIdAndPaymentId(UUID merchantId, UUID paymentId);
    List<Refund> findAllByMerchantId(UUID merchantId);
    long countByMerchantIdAndCustomerId(UUID merchantId, UUID customerId);

    @Modifying
    @Query("DELETE FROM Refund r WHERE r.merchantId = :merchantId")
    void deleteAllByMerchantId(UUID merchantId);
}

package com.niro.modules.customer.infrastructure;

import com.niro.modules.customer.domain.Customer;
import com.niro.modules.customer.domain.CustomerRepository;
import com.niro.modules.customer.domain.CustomerStatus;
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
public interface JpaCustomerRepository extends JpaRepository<Customer, UUID>, CustomerRepository {
    Optional<Customer> findByMerchantIdAndId(UUID merchantId, UUID id);
    Page<Customer> findByMerchantId(UUID merchantId, Pageable pageable);
    Page<Customer> findByMerchantIdAndStatus(UUID merchantId, CustomerStatus status, Pageable pageable);
    long countByMerchantId(UUID merchantId);
    long countByMerchantIdAndStatus(UUID merchantId, CustomerStatus status);
    List<Customer> findAllByMerchantId(UUID merchantId);

    @Modifying
    @Query("DELETE FROM Customer c WHERE c.merchantId = :merchantId")
    void deleteAllByMerchantId(UUID merchantId);
}

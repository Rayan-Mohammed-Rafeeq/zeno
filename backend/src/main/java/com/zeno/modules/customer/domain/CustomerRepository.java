package com.zeno.modules.customer.domain;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CustomerRepository {
    Optional<Customer> findByMerchantIdAndId(UUID merchantId, UUID id);
    Page<Customer> findByMerchantId(UUID merchantId, Pageable pageable);
    Page<Customer> findByMerchantIdAndStatus(UUID merchantId, CustomerStatus status, Pageable pageable);
    long countByMerchantId(UUID merchantId);
    long countByMerchantIdAndStatus(UUID merchantId, CustomerStatus status);
    List<Customer> findAllByMerchantId(UUID merchantId);
    /** Webhook upsert — look up an existing customer by merchant's external customer ID. */
    Optional<Customer> findByMerchantIdAndExternalCustomerId(UUID merchantId, String externalCustomerId);
    /** Bulk lookup — fetch a set of customers by their internal IDs. */
    List<Customer> findAllByMerchantIdAndIdIn(UUID merchantId, List<UUID> ids);
    /** Text search on externalCustomerId (case-insensitive contains). */
    Page<Customer> findByMerchantIdAndExternalCustomerIdContainingIgnoreCase(UUID merchantId, String search, Pageable pageable);
}

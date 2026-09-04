package com.zeno.modules.customer.application;

import com.zeno.modules.customer.domain.Customer;
import com.zeno.modules.customer.domain.CustomerRepository;
import com.zeno.modules.customer.domain.CustomerStatus;
import com.zeno.modules.customer.interfaces.dto.CustomerResponse;
import com.zeno.shared.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CustomerService {

    private final CustomerRepository customerRepository;

    @Transactional(readOnly = true)
    public Page<CustomerResponse> listCustomers(UUID merchantId, CustomerStatus status, Pageable pageable) {
        Page<Customer> page = (status != null)
                ? customerRepository.findByMerchantIdAndStatus(merchantId, status, pageable)
                : customerRepository.findByMerchantId(merchantId, pageable);
        return page.map(CustomerResponse::from);
    }

    @Transactional(readOnly = true)
    public CustomerResponse getCustomer(UUID merchantId, UUID customerId) {
        Customer customer = customerRepository.findByMerchantIdAndId(merchantId, customerId)
                .orElseThrow(() -> new ResourceNotFoundException("Customer", customerId));
        return CustomerResponse.from(customer);
    }
}

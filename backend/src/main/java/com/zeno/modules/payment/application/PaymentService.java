package com.zeno.modules.payment.application;

import com.zeno.modules.payment.domain.Payment;
import com.zeno.modules.payment.domain.PaymentRepository;
import com.zeno.modules.payment.interfaces.dto.PaymentResponse;
import com.zeno.shared.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PaymentService {

    private final PaymentRepository paymentRepository;

    @Transactional(readOnly = true)
    public Page<PaymentResponse> listPayments(UUID merchantId, Pageable pageable) {
        return paymentRepository.findByMerchantId(merchantId, pageable)
                .map(PaymentResponse::from);
    }

    @Transactional(readOnly = true)
    public PaymentResponse getPayment(UUID merchantId, UUID paymentId) {
        Payment payment = paymentRepository.findByMerchantIdAndId(merchantId, paymentId)
                .orElseThrow(() -> new ResourceNotFoundException("Payment", paymentId));
        return PaymentResponse.from(payment);
    }
}

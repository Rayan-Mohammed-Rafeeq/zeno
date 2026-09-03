package com.niro.modules.refund.application;

import com.niro.modules.refund.domain.Refund;
import com.niro.modules.refund.domain.RefundRepository;
import com.niro.modules.refund.interfaces.dto.RefundResponse;
import com.niro.shared.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RefundService {

    private final RefundRepository refundRepository;

    @Transactional(readOnly = true)
    public Page<RefundResponse> listRefunds(UUID merchantId, Pageable pageable) {
        return refundRepository.findByMerchantId(merchantId, pageable)
                .map(RefundResponse::from);
    }

    @Transactional(readOnly = true)
    public RefundResponse getRefund(UUID merchantId, UUID refundId) {
        Refund refund = refundRepository.findByMerchantIdAndId(merchantId, refundId)
                .orElseThrow(() -> new ResourceNotFoundException("Refund", refundId));
        return RefundResponse.from(refund);
    }
}

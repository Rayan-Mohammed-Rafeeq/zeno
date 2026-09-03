package com.niro.modules.risk.application.detector;

import com.niro.modules.customer.domain.Customer;
import com.niro.modules.payment.domain.Payment;
import com.niro.modules.refund.domain.Refund;
import lombok.Builder;
import lombok.Getter;

import java.util.List;
import java.util.UUID;

/**
 * All observable evidence available to risk signal detectors.
 * Detectors may only read from this context — never from ground truth.
 */
@Getter
@Builder
public class RiskContext {
    private final UUID merchantId;
    private final Customer customer;
    private final List<Payment> customerPayments;
    private final List<Refund> customerRefunds;
    /** All payments by other customers using the same device(s) as this customer */
    private final List<Payment> sharedDevicePayments;
    /** All payments by other customers using the same IP(s) as this customer */
    private final List<Payment> sharedIpPayments;
    /** Merchant-wide baseline refund rate (0.0–1.0) */
    private final double merchantBaselineRefundRate;
}

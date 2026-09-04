package com.zeno.modules.ml.application;

import com.zeno.config.ZenoProperties;
import com.zeno.modules.customer.domain.Customer;
import com.zeno.modules.ml.domain.MlPrediction;
import com.zeno.modules.ml.domain.MlPredictionRepository;
import com.zeno.modules.ml.infrastructure.MlServiceClient;
import com.zeno.modules.ml.interfaces.dto.MlPredictionRequest;
import com.zeno.modules.ml.interfaces.dto.MlPredictionResponse;
import com.zeno.modules.payment.domain.Payment;
import com.zeno.modules.payment.infrastructure.JpaPaymentRepository;
import com.zeno.modules.refund.infrastructure.JpaRefundRepository;
import com.zeno.shared.exception.ExternalServiceException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Orchestrates ML predictions: builds the request, calls the service,
 * persists the result, and provides a graceful fallback.
 *
 * FALLBACK STRATEGY
 * ──────────────────
 * When the ML service is unavailable, disabled, or returns an error:
 *   - Log a WARNING (not an ERROR — this is an expected degraded state).
 *   - Return Optional.empty().
 *   - The RiskEngine then uses only the rule-based signal detectors.
 *   - Never silently treat a missing ML score as a zero fraud probability.
 *
 * MERCHANT ISOLATION
 * ──────────────────
 * merchantId flows through every call so the customer context query
 * is always scoped to the correct tenant.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MlPredictionOrchestrator {

    private final ZenoProperties properties;
    private final MlServiceClient mlServiceClient;
    private final MlPredictionRepository predictionRepository;
    private final JpaPaymentRepository paymentRepository;
    private final JpaRefundRepository refundRepository;

    /**
     * Score a customer using the ML service.
     *
     * Uses the most recent payment for the customer as the anchor transaction.
     * Customer context is built from payments strictly before that transaction.
     *
     * @return Optional containing the prediction, or empty if ML is disabled/unavailable.
     */
    @Transactional
    public Optional<MlPredictionResponse> scoreCustomer(UUID merchantId, Customer customer) {
        if (!properties.getMl().isEnabled()) {
            return Optional.empty();
        }

        List<Payment> allPayments = paymentRepository
                .findAllByMerchantIdAndCustomerId(merchantId, customer.getId());

        if (allPayments.isEmpty()) {
            log.debug("No payments for customer {} — skipping ML score.", customer.getId());
            return Optional.empty();
        }

        // Use the most recent payment as the prediction anchor
        Payment anchor = allPayments.stream()
                .max(java.util.Comparator.comparing(Payment::getTimestamp))
                .orElseThrow();

        // Prior payments: strictly before anchor timestamp (temporal leakage prevention)
        List<Payment> priorPayments = allPayments.stream()
                .filter(p -> p.getTimestamp().isBefore(anchor.getTimestamp()))
                .collect(Collectors.toList());

        var priorRefunds = refundRepository
                .findAllByMerchantIdAndCustomerId(merchantId, customer.getId())
                .stream()
                .filter(r -> r.getRequestedAt() != null
                        && r.getRequestedAt().isBefore(anchor.getTimestamp()))
                .collect(Collectors.toList());

        MlPredictionRequest request = MlPredictionRequest.from(
                anchor, customer, priorPayments, priorRefunds
        );

        try {
            MlPredictionResponse response = mlServiceClient.predict(request);

            // Persist for audit trail
            persistPrediction(merchantId, customer.getId(), response);

            return Optional.of(response);

        } catch (ExternalServiceException ex) {
            log.warn(
                "ML service unavailable for customer {} — falling back to rule-based scoring. " +
                "Reason: {}",
                customer.getId(), ex.getMessage()
            );
            return Optional.empty();
        } catch (Exception ex) {
            log.warn(
                "Unexpected ML scoring error for customer {} — falling back. Error: {}",
                customer.getId(), ex.getMessage()
            );
            return Optional.empty();
        }
    }

    private void persistPrediction(UUID merchantId, UUID customerId, MlPredictionResponse resp) {
        try {
            var contributions = resp.featureContributions() == null ? null :
                    resp.featureContributions().stream()
                            .map(fc -> new MlPrediction.FeatureContributionEntry(
                                    fc.feature(), fc.shapValue(), fc.direction(), fc.rank()))
                            .collect(Collectors.toList());

            MlPrediction prediction = MlPrediction.builder()
                    .merchantId(merchantId)
                    .customerId(customerId)
                    .fraudProbability(resp.fraudProbability())
                    .anomalyScore(resp.anomalyScore())
                    .riskScore(resp.riskScore())
                    .riskLevel(resp.riskLevel())
                    .threshold(resp.threshold())
                    .featureContributions(contributions)
                    .processingMs(resp.processingMs())
                    .build();

            predictionRepository.save(prediction);
        } catch (Exception ex) {
            // Persistence failure must not disrupt the scoring flow
            log.warn("Failed to persist ML prediction for customer {}: {}", customerId, ex.getMessage());
        }
    }
}

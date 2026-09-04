package com.zeno.modules.dataset.application;

import com.zeno.modules.customer.domain.Customer;
import com.zeno.modules.customer.domain.CustomerStatus;
import com.zeno.modules.dataset.domain.DatasetRun;
import com.zeno.modules.dataset.domain.GroundTruthLabel;
import com.zeno.modules.payment.domain.Payment;
import com.zeno.modules.payment.domain.PaymentMethod;
import com.zeno.modules.payment.domain.PaymentStatus;
import com.zeno.modules.refund.domain.Refund;
import com.zeno.modules.refund.domain.RefundReason;
import com.zeno.modules.refund.domain.RefundStatus;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * Generates deterministic synthetic datasets for defensive evaluation.
 *
 * Profile mix:
 *  - ~70% normal customers with realistic payment/refund behaviour
 *  - ~15% suspicious single customers (elevated refund rate, new account)
 *  - ~15% coordinated abuse clusters (shared device/IP, high refund rates)
 *
 * Ground truth labels are produced ALONGSIDE data but must NOT be used
 * by the risk detector — they exist solely for evaluation metrics.
 */
@Slf4j
@Component
public class SyntheticDataGenerator {

    // Scenario type constants
    public static final String SCENARIO_NORMAL             = "NORMAL";
    public static final String SCENARIO_REFUND_ABUSE       = "REFUND_ABUSE";
    public static final String SCENARIO_COORDINATED_CLUSTER = "COORDINATED_CLUSTER";
    public static final String SCENARIO_HIGH_VELOCITY      = "HIGH_VELOCITY";

    private static final String[] COUNTRIES = {"US","GB","IN","DE","FR","CA","AU","SG","BR","NL"};
    private static final String[] CURRENCIES = {"USD","GBP","EUR","INR","AUD","SGD"};
    private static final PaymentMethod[] METHODS = PaymentMethod.values();
    private static final RefundReason[] REASONS = RefundReason.values();

    public GeneratedDataset generate(UUID merchantId, UUID datasetRunId, int recordCount, long seed) {
        Random rng = new Random(seed);
        Instant now = Instant.now();

        List<Customer> customers = new ArrayList<>();
        List<Payment> payments   = new ArrayList<>();
        List<Refund>  refunds    = new ArrayList<>();
        List<GroundTruthLabel> labels = new ArrayList<>();

        // ---------- proportion split ----------
        int clusterCustomerCount   = Math.max(2, (int)(recordCount * 0.08));
        int abuseCustomerCount     = Math.max(2, (int)(recordCount * 0.07));
        int velocityCustomerCount  = Math.max(1, (int)(recordCount * 0.05));
        int normalCustomerCount    = recordCount
                - clusterCustomerCount - abuseCustomerCount - velocityCustomerCount;

        // ---------- shared infra pools ----------
        // Each cluster group shares a device + IP
        int clusterGroupCount = Math.max(1, clusterCustomerCount / 4);
        List<String> clusterDevices = new ArrayList<>();
        List<String> clusterIps    = new ArrayList<>();
        for (int i = 0; i < clusterGroupCount; i++) {
            clusterDevices.add("DEV-CLUSTER-" + i + "-" + randomHex(rng, 6));
            clusterIps.add("10.20." + rng.nextInt(255) + "." + rng.nextInt(255));
        }

        // ---------- 1. Normal customers ----------
        for (int i = 0; i < normalCustomerCount; i++) {
            Customer c = buildCustomer(merchantId, rng, now, "NORMAL", 30, 3650);
            customers.add(c);
            int txCount = 2 + rng.nextInt(8);
            List<Payment> txs = buildPayments(merchantId, c, rng, now, txCount,
                    randomDevice(rng), randomIp(rng), false);
            payments.addAll(txs);
            // ~10% refund rate for normal customers
            if (!txs.isEmpty() && rng.nextDouble() < 0.10) {
                Payment tx = txs.get(rng.nextInt(txs.size()));
                refunds.add(buildRefund(merchantId, c.getId(), tx, rng, now));
            }
            labels.add(groundTruth(datasetRunId, merchantId, "CUSTOMER", c.getId(), false, null, SCENARIO_NORMAL));
        }

        // ---------- 2. Solo refund-abuse customers ----------
        for (int i = 0; i < abuseCustomerCount; i++) {
            // New accounts (0–30 days), high refund rate
            Customer c = buildCustomer(merchantId, rng, now, "REFUND_ABUSER", 0, 30);
            customers.add(c);
            int txCount = 3 + rng.nextInt(6);
            List<Payment> txs = buildPayments(merchantId, c, rng, now, txCount,
                    randomDevice(rng), randomIp(rng), false);
            payments.addAll(txs);
            // 60–100% refund rate
            double refundRate = 0.6 + rng.nextDouble() * 0.4;
            for (Payment tx : txs) {
                if (rng.nextDouble() < refundRate) {
                    refunds.add(buildRefund(merchantId, c.getId(), tx, rng, now));
                }
            }
            labels.add(groundTruth(datasetRunId, merchantId, "CUSTOMER", c.getId(), true,
                    "ABUSE-SOLO-" + i, SCENARIO_REFUND_ABUSE));
        }

        // ---------- 3. Coordinated cluster customers ----------
        int groupSize = Math.max(4, clusterCustomerCount / clusterGroupCount);
        for (int g = 0; g < clusterGroupCount; g++) {
            String sharedDevice = clusterDevices.get(g);
            String sharedIp     = clusterIps.get(g);
            String clusterId    = "CLUSTER-" + g;
            int membersInGroup  = Math.min(groupSize, clusterCustomerCount - (g * groupSize));
            if (membersInGroup <= 0) break;

            for (int m = 0; m < membersInGroup; m++) {
                Customer c = buildCustomer(merchantId, rng, now, "COORDINATOR", 0, 60);
                customers.add(c);
                int txCount = 2 + rng.nextInt(5);
                List<Payment> txs = buildPayments(merchantId, c, rng, now, txCount,
                        sharedDevice, sharedIp, true);
                payments.addAll(txs);
                // High refund rate for cluster members
                double refundRate = 0.5 + rng.nextDouble() * 0.4;
                for (Payment tx : txs) {
                    if (rng.nextDouble() < refundRate) {
                        refunds.add(buildRefund(merchantId, c.getId(), tx, rng, now));
                    }
                }
                labels.add(groundTruth(datasetRunId, merchantId, "CUSTOMER", c.getId(), true,
                        clusterId, SCENARIO_COORDINATED_CLUSTER));
            }
        }

        // ---------- 4. High-velocity customers ----------
        for (int i = 0; i < velocityCustomerCount; i++) {
            Customer c = buildCustomer(merchantId, rng, now, "HIGH_VELOCITY", 0, 90);
            customers.add(c);
            // 15–30 transactions in a short window
            int txCount = 15 + rng.nextInt(15);
            List<Payment> txs = buildPayments(merchantId, c, rng, now, txCount,
                    randomDevice(rng), randomIp(rng), false);
            // Make timestamps very close together (velocity signal)
            Instant burstStart = now.minus(2, ChronoUnit.HOURS);
            for (int t = 0; t < txs.size(); t++) {
                txs.get(t).setTimestamp(burstStart.plus(t * 3L, ChronoUnit.MINUTES));
            }
            payments.addAll(txs);
            // Moderate refund rate
            double refundRate = 0.3 + rng.nextDouble() * 0.3;
            for (Payment tx : txs) {
                if (rng.nextDouble() < refundRate) {
                    refunds.add(buildRefund(merchantId, c.getId(), tx, rng, now));
                }
            }
            labels.add(groundTruth(datasetRunId, merchantId, "CUSTOMER", c.getId(), true,
                    "VELOCITY-" + i, SCENARIO_HIGH_VELOCITY));
        }

        log.info("Dataset generated: {} customers, {} payments, {} refunds, {} labels (seed={})",
                customers.size(), payments.size(), refunds.size(), labels.size(), seed);

        return new GeneratedDataset(customers, payments, refunds, labels);
    }

    // ---- builders ----

    private Customer buildCustomer(UUID merchantId, Random rng, Instant now,
                                   String profileType, int minAge, int maxAge) {
        int ageDays = minAge + (maxAge > minAge ? rng.nextInt(maxAge - minAge) : 0);
        return Customer.builder()
                .merchantId(merchantId)
                .externalCustomerId("EXT-" + randomHex(rng, 10))
                .accountAgeDays(ageDays)
                .status(CustomerStatus.ACTIVE)
                .country(COUNTRIES[rng.nextInt(COUNTRIES.length)])
                .region("Region-" + (char)('A' + rng.nextInt(6)))
                .syntheticProfileType(profileType)
                .createdAt(now.minus(ageDays, ChronoUnit.DAYS))
                .build();
    }

    private List<Payment> buildPayments(UUID merchantId, Customer customer, Random rng,
                                        Instant now, int count,
                                        String deviceId, String ip, boolean similarAmounts) {
        List<Payment> list = new ArrayList<>();
        String currency = CURRENCIES[rng.nextInt(CURRENCIES.length)];
        // Base amount for similarity detection
        double baseAmount = 20 + rng.nextDouble() * 180;

        for (int i = 0; i < count; i++) {
            double rawAmount = similarAmounts
                    ? baseAmount + (rng.nextDouble() * 2 - 1)     // very similar amounts
                    : 5 + rng.nextDouble() * 495;                  // varied

            BigDecimal amount = BigDecimal.valueOf(rawAmount).setScale(2, RoundingMode.HALF_UP);
            Instant ts = now.minus(rng.nextInt(90), ChronoUnit.DAYS)
                          .minus(rng.nextInt(86400), ChronoUnit.SECONDS);

            list.add(Payment.builder()
                    .merchantId(merchantId)
                    .customerId(customer.getId())
                    .externalPaymentId("PAY-" + randomHex(rng, 10))
                    .amount(amount)
                    .currency(currency)
                    .timestamp(ts)
                    .status(PaymentStatus.SUCCESS)
                    .paymentMethod(METHODS[rng.nextInt(METHODS.length)])
                    .deviceId(deviceId)
                    .ipAddress(ip)
                    .addressFingerprint("ADDR-" + randomHex(rng, 8))
                    .build());
        }
        return list;
    }

    private Refund buildRefund(UUID merchantId, UUID customerId, Payment payment,
                               Random rng, Instant now) {
        Instant requestedAt = payment.getTimestamp().plus(1 + rng.nextInt(5), ChronoUnit.DAYS);
        if (requestedAt.isAfter(now)) requestedAt = now.minus(1, ChronoUnit.HOURS);

        return Refund.builder()
                .merchantId(merchantId)
                .paymentId(payment.getId())
                .customerId(customerId)
                .amount(payment.getAmount())
                .reason(REASONS[rng.nextInt(REASONS.length)])
                .status(RefundStatus.COMPLETED)
                .requestedAt(requestedAt)
                .completedAt(requestedAt.plus(1 + rng.nextInt(3), ChronoUnit.DAYS))
                .build();
    }

    private GroundTruthLabel groundTruth(UUID datasetRunId, UUID merchantId,
                                         String entityType, UUID entityId,
                                         boolean positive, String clusterId, String scenario) {
        return GroundTruthLabel.builder()
                .datasetRunId(datasetRunId)
                .merchantId(merchantId)
                .entityType(entityType)
                .entityId(entityId)
                .positive(positive)
                .abuseClusterId(clusterId)
                .scenarioType(scenario)
                .build();
    }

    private String randomDevice(Random rng) {
        return "DEV-" + randomHex(rng, 10);
    }

    private String randomIp(Random rng) {
        return (1 + rng.nextInt(254)) + "." +
               rng.nextInt(256) + "." +
               rng.nextInt(256) + "." +
               rng.nextInt(256);
    }

    private String randomHex(Random rng, int chars) {
        StringBuilder sb = new StringBuilder(chars);
        for (int i = 0; i < chars; i++) {
            sb.append("0123456789abcdef".charAt(rng.nextInt(16)));
        }
        return sb.toString().toUpperCase();
    }

    // ---- result carrier ----

    public record GeneratedDataset(
            List<Customer> customers,
            List<Payment> payments,
            List<Refund> refunds,
            List<GroundTruthLabel> labels
    ) {}
}

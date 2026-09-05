package com.zeno.modules.dataset.application;

import com.zeno.modules.dataset.domain.*;
import com.zeno.modules.dataset.infrastructure.JpaDatasetRunRepository;
import com.zeno.modules.dataset.infrastructure.JpaGroundTruthLabelRepository;
import com.zeno.modules.dataset.interfaces.dto.DatasetRunResponse;
import com.zeno.modules.dataset.interfaces.dto.GenerateDatasetRequest;
import com.zeno.modules.customer.infrastructure.JpaCustomerRepository;
import com.zeno.modules.payment.infrastructure.JpaPaymentRepository;
import com.zeno.modules.refund.infrastructure.JpaRefundRepository;
import com.zeno.modules.risk.application.RiskEngine;
import com.zeno.modules.graph.application.GraphService;
import com.zeno.shared.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class DatasetService {

    private static final int MAX_RECORD_COUNT = 5000;
    private static final int MIN_RECORD_COUNT = 10;

    private final JpaDatasetRunRepository       datasetRunRepository;
    private final JpaGroundTruthLabelRepository groundTruthLabelRepository;
    private final JpaCustomerRepository         customerRepository;
    private final JpaPaymentRepository          paymentRepository;
    private final JpaRefundRepository           refundRepository;
    private final SyntheticDataGenerator        generator;
    private final RiskEngine                    riskEngine;
    private final GraphService                  graphService;

    /**
     * Full pipeline: generate synthetic data → risk analysis → cluster detection.
     *
     * Steps:
     *  1. Generate customers, payments, refunds, ground-truth labels
     *  2. Run risk analysis on all generated customers (populates risk_assessments + risk_signals)
     *  3. Run cluster detection (populates risk_clusters)
     *
     * Steps 2 and 3 are non-fatal — if they fail, the dataset is still usable
     * and the user can re-run analysis from the Risk / Clusters pages.
     */
    @Transactional
    public DatasetRunResponse generate(UUID merchantId, GenerateDatasetRequest request) {
        int  count = Math.min(Math.max(request.recordCount(), MIN_RECORD_COUNT), MAX_RECORD_COUNT);
        long seed  = request.seed() != null ? request.seed() : System.currentTimeMillis();

        // ── Clear existing data for this merchant ─────────────────────────────
        log.info("Clearing existing synthetic data for merchant {}", merchantId);
        refundRepository.deleteAllByMerchantId(merchantId);
        paymentRepository.deleteAllByMerchantId(merchantId);
        customerRepository.deleteAllByMerchantId(merchantId);
        groundTruthLabelRepository.deleteAllByMerchantId(merchantId);

        DatasetRun run = DatasetRun.builder()
                .merchantId(merchantId)
                .recordCount(count)
                .seed(seed)
                .status(DatasetStatus.GENERATING)
                .build();
        run = datasetRunRepository.save(run);

        try {
            // ── Step 1: Generate synthetic data ───────────────────────────────
            // Customers and payments are saved inline so refunds can reference real IDs.
            java.util.function.Function<com.zeno.modules.customer.domain.Customer,
                    com.zeno.modules.customer.domain.Customer> customerSaver = customerRepository::saveAndFlush;
            java.util.function.Function<com.zeno.modules.payment.domain.Payment,
                    com.zeno.modules.payment.domain.Payment> paymentSaver = paymentRepository::saveAndFlush;

            SyntheticDataGenerator.GeneratedDataset dataset =
                    generator.generate(merchantId, run.getId(), count, seed, customerSaver, paymentSaver);

            refundRepository.saveAll(dataset.refunds());
            groundTruthLabelRepository.saveAll(dataset.labels());

            log.info("Step 1 complete — {} customers, {} payments, {} refunds",
                    dataset.customers().size(), dataset.payments().size(), dataset.refunds().size());

            // ── Step 2: Risk analysis ─────────────────────────────────────────
            log.info("Step 2: running risk analysis for {} customers", dataset.customers().size());
            try {
                var assessments = riskEngine.analyzeAllCustomers(merchantId);
                log.info("Step 2 complete — {} risk assessments created", assessments.size());
            } catch (Exception ex) {
                log.error("Step 2 (risk analysis) failed — non-fatal, continuing: {}", ex.getMessage(), ex);
            }

            // ── Step 3: Cluster detection ─────────────────────────────────────
            log.info("Step 3: running cluster detection");
            try {
                var clusters = graphService.detectClusters(merchantId);
                log.info("Step 3 complete — {} clusters detected", clusters.size());
            } catch (Exception ex) {
                log.error("Step 3 (cluster detection) failed — non-fatal, continuing: {}", ex.getMessage(), ex);
            }

            run.setStatus(DatasetStatus.COMPLETED);
            run.setGeneratedAt(Instant.now());
            run = datasetRunRepository.save(run);

            log.info("Dataset {} fully completed (data + risk + clusters)", run.getId());

        } catch (Exception ex) {
            log.error("Dataset generation failed for run {}: {}", run.getId(), ex.getMessage(), ex);
            run.setStatus(DatasetStatus.FAILED);
            datasetRunRepository.save(run);
            throw ex;
        }

        return DatasetRunResponse.from(run);
    }

    @Transactional(readOnly = true)
    public DatasetRunResponse getCurrentDataset(UUID merchantId) {
        DatasetRun run = datasetRunRepository.findTopByMerchantIdOrderByCreatedAtDesc(merchantId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "No dataset found. Please generate a dataset first."));
        return DatasetRunResponse.from(run);
    }
}

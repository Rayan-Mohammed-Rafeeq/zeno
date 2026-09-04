package com.zeno.modules.dataset.application;

import com.zeno.modules.dataset.domain.*;
import com.zeno.modules.dataset.infrastructure.JpaDatasetRunRepository;
import com.zeno.modules.dataset.infrastructure.JpaGroundTruthLabelRepository;
import com.zeno.modules.dataset.interfaces.dto.DatasetRunResponse;
import com.zeno.modules.dataset.interfaces.dto.GenerateDatasetRequest;
import com.zeno.modules.customer.infrastructure.JpaCustomerRepository;
import com.zeno.modules.payment.infrastructure.JpaPaymentRepository;
import com.zeno.modules.refund.infrastructure.JpaRefundRepository;
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

    private final JpaDatasetRunRepository datasetRunRepository;
    private final JpaGroundTruthLabelRepository groundTruthLabelRepository;
    private final JpaCustomerRepository customerRepository;
    private final JpaPaymentRepository paymentRepository;
    private final JpaRefundRepository refundRepository;
    private final SyntheticDataGenerator generator;

    @Transactional
    public DatasetRunResponse generate(UUID merchantId, GenerateDatasetRequest request) {
        int count = Math.min(Math.max(request.recordCount(), MIN_RECORD_COUNT), MAX_RECORD_COUNT);
        long seed = request.seed() != null ? request.seed() : System.currentTimeMillis();

        // Clear existing data for this merchant so the new dataset is clean
        log.info("Clearing existing synthetic data for merchant {}", merchantId);
        refundRepository.deleteAllByMerchantId(merchantId);
        paymentRepository.deleteAllByMerchantId(merchantId);
        customerRepository.deleteAllByMerchantId(merchantId);
        groundTruthLabelRepository.deleteAllByMerchantId(merchantId);

        // Create the run record
        DatasetRun run = DatasetRun.builder()
                .merchantId(merchantId)
                .recordCount(count)
                .seed(seed)
                .status(DatasetStatus.GENERATING)
                .build();
        run = datasetRunRepository.save(run);

        try {
            SyntheticDataGenerator.GeneratedDataset dataset =
                    generator.generate(merchantId, run.getId(), count, seed);

            customerRepository.saveAll(dataset.customers());
            paymentRepository.saveAll(dataset.payments());
            refundRepository.saveAll(dataset.refunds());
            groundTruthLabelRepository.saveAll(dataset.labels());

            run.setStatus(DatasetStatus.COMPLETED);
            run.setGeneratedAt(Instant.now());
            run = datasetRunRepository.save(run);

            log.info("Dataset {} completed: {} customers, {} payments, {} refunds",
                    run.getId(), dataset.customers().size(),
                    dataset.payments().size(), dataset.refunds().size());

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

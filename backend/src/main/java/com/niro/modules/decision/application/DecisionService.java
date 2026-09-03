package com.niro.modules.decision.application;

import com.niro.modules.decision.domain.DecisionRecommendation;
import com.niro.modules.decision.domain.DecisionRepository;
import com.niro.modules.decision.domain.DecisionType;
import com.niro.modules.decision.interfaces.dto.DecisionResponse;
import com.niro.modules.decision.interfaces.dto.RecommendRequest;
import com.niro.modules.risk.domain.RiskAssessmentRepository;
import com.niro.modules.risk.domain.RiskLevel;
import com.niro.shared.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class DecisionService {

    private final DecisionPolicy policy;
    private final DecisionRepository decisionRepository;
    private final RiskAssessmentRepository riskAssessmentRepository;

    @Transactional
    public DecisionResponse recommend(UUID merchantId, RecommendRequest request) {
        var riskAssessment = riskAssessmentRepository
                .findTopByMerchantIdAndCustomerIdOrderByCreatedAtDesc(merchantId, request.subjectId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "No risk assessment found for subject. Run risk analysis first."));

        RiskLevel riskLevel = riskAssessment.getRiskLevel();
        DecisionType decision = policy.recommend(riskLevel);
        boolean overridden = false;
        String overrideReason = null;

        // Apply override if explicitly requested and valid
        if (request.overrideDecision() != null) {
            decision = request.overrideDecision();
            overridden = true;
            overrideReason = request.overrideReason() != null
                    ? request.overrideReason()
                    : "Manual override by analyst";
        }

        String rationale = policy.rationale(riskLevel, decision);

        DecisionRecommendation recommendation = DecisionRecommendation.builder()
                .merchantId(merchantId)
                .subjectType(request.subjectType())
                .subjectId(request.subjectId())
                .riskLevel(riskLevel)
                .riskScore(riskAssessment.getRiskScore())
                .decision(decision)
                .rationale(rationale)
                .overridden(overridden)
                .overrideReason(overrideReason)
                .build();
        recommendation = decisionRepository.save(recommendation);

        log.info("Decision for {} {}: {} (overridden={})", request.subjectType(), request.subjectId(), decision, overridden);
        return DecisionResponse.from(recommendation);
    }

    @Transactional(readOnly = true)
    public Page<DecisionResponse> list(UUID merchantId, Pageable pageable) {
        return decisionRepository.findByMerchantId(merchantId, pageable).map(DecisionResponse::from);
    }
}

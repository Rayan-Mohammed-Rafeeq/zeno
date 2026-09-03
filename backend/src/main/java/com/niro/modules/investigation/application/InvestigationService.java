package com.niro.modules.investigation.application;

import com.niro.modules.investigation.domain.*;
import com.niro.modules.investigation.interfaces.dto.*;
import com.niro.shared.exception.BusinessRuleException;
import com.niro.shared.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class InvestigationService {

    private final InvestigationRepository investigationRepository;
    private final InvestigationNoteRepository noteRepository;

    @Transactional
    public InvestigationResponse create(UUID merchantId, UUID userId, CreateInvestigationRequest request) {
        Investigation investigation = Investigation.builder()
                .merchantId(merchantId)
                .subjectType(request.subjectType())
                .subjectId(request.subjectId())
                .riskLevel(request.riskLevel())
                .status(InvestigationStatus.OPEN)
                .assignedTo(request.assignedTo() != null ? request.assignedTo() : userId)
                .build();
        investigation = investigationRepository.save(investigation);
        log.info("Investigation created: {} for {} {}", investigation.getId(),
                request.subjectType(), request.subjectId());
        return InvestigationResponse.from(investigation);
    }

    @Transactional(readOnly = true)
    public Page<InvestigationResponse> list(UUID merchantId, InvestigationStatus status, Pageable pageable) {
        Page<Investigation> page = (status != null)
                ? investigationRepository.findByMerchantIdAndStatus(merchantId, status, pageable)
                : investigationRepository.findByMerchantId(merchantId, pageable);
        return page.map(inv -> {
            List<InvestigationNote> notes = noteRepository.findAllByInvestigationId(inv.getId());
            return InvestigationResponse.from(inv, notes);
        });
    }

    @Transactional(readOnly = true)
    public InvestigationResponse get(UUID merchantId, UUID investigationId) {
        Investigation inv = findScoped(merchantId, investigationId);
        List<InvestigationNote> notes = noteRepository.findAllByInvestigationId(investigationId);
        return InvestigationResponse.from(inv, notes);
    }

    @Transactional
    public InvestigationResponse updateStatus(UUID merchantId, UUID investigationId, UpdateStatusRequest request) {
        Investigation inv = findScoped(merchantId, investigationId);
        if (inv.getStatus() == InvestigationStatus.RESOLVED && request.status() != InvestigationStatus.RESOLVED) {
            throw new BusinessRuleException("INVESTIGATION_RESOLVED",
                    "A resolved investigation cannot be reopened via status update");
        }
        inv.setStatus(request.status());
        inv = investigationRepository.save(inv);
        log.info("Investigation {} status updated to {}", investigationId, request.status());
        return InvestigationResponse.from(inv);
    }

    @Transactional
    public InvestigationResponse addNote(UUID merchantId, UUID investigationId, UUID authorId, AddNoteRequest request) {
        Investigation inv = findScoped(merchantId, investigationId);
        InvestigationNote note = InvestigationNote.builder()
                .investigationId(investigationId)
                .authorId(authorId)
                .content(request.content())
                .build();
        noteRepository.save(note);
        List<InvestigationNote> notes = noteRepository.findAllByInvestigationId(investigationId);
        return InvestigationResponse.from(inv, notes);
    }

    private Investigation findScoped(UUID merchantId, UUID investigationId) {
        return investigationRepository.findByMerchantIdAndId(merchantId, investigationId)
                .orElseThrow(() -> new ResourceNotFoundException("Investigation", investigationId));
    }
}

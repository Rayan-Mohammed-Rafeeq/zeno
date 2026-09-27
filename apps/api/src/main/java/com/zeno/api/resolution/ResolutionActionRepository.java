package com.zeno.api.resolution;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ResolutionActionRepository extends JpaRepository<ResolutionAction, Long> {
    List<ResolutionAction> findByResolutionCaseIdOrderByCreatedAtAsc(Long caseId);
    List<ResolutionAction> findByResolutionCaseIdAndStatus(Long caseId, ActionStatus status);
    List<ResolutionAction> findByAssignedUserId(Long userId);
}

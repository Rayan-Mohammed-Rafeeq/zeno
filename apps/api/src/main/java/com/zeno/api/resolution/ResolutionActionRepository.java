package com.zeno.api.resolution;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ResolutionActionRepository extends JpaRepository<ResolutionAction, Long> {
    @Query("SELECT a FROM ResolutionAction a " +
           "LEFT JOIN FETCH a.assignedUser " +
           "LEFT JOIN FETCH a.completedBy " +
           "WHERE a.resolutionCase.id = :caseId " +
           "ORDER BY a.createdAt ASC")
    List<ResolutionAction> findByResolutionCaseIdOrderByCreatedAtAsc(@Param("caseId") Long caseId);
    List<ResolutionAction> findByResolutionCaseIdAndStatus(Long caseId, ActionStatus status);
    List<ResolutionAction> findByAssignedUserId(Long userId);
}

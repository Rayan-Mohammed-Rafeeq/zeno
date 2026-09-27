package com.zeno.api.resolution;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ResolutionCaseRepository extends JpaRepository<ResolutionCase, Long> {
    Optional<ResolutionCase> findByRefillRequestId(Long refillRequestId);
    List<ResolutionCase> findByStatus(ResolutionStatus status);
    List<ResolutionCase> findByAssignedToId(Long userId);

    @Query("SELECT rc FROM ResolutionCase rc " +
           "WHERE rc.status NOT IN ('RESOLVED', 'CANCELLED') " +
           "AND (rc.refillRequest.pharmacy.organization.id = :orgId " +
           "  OR rc.refillRequest.patient.organization.id = :orgId) " +
           "ORDER BY rc.priority DESC, rc.createdAt ASC")
    List<ResolutionCase> findActiveByOrganizationId(@Param("orgId") Long orgId);

    @Query("SELECT COUNT(rc) FROM ResolutionCase rc " +
           "WHERE rc.status NOT IN ('RESOLVED', 'CANCELLED') " +
           "AND (rc.refillRequest.pharmacy.organization.id = :orgId " +
           "  OR rc.refillRequest.patient.organization.id = :orgId)")
    long countActiveByOrganizationId(@Param("orgId") Long orgId);
}

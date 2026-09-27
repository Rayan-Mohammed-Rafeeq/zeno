package com.zeno.api.refill;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RefillRequestRepository extends JpaRepository<RefillRequest, Long> {

    List<RefillRequest> findByStatus(RefillStatus status);
    List<RefillRequest> findByBlockerType(BlockerType blockerType);
    List<RefillRequest> findByPatientId(Long patientId);
    List<RefillRequest> findByPharmacyId(Long pharmacyId);
    List<RefillRequest> findByPrescriptionId(Long prescriptionId);

    @Query("SELECT r FROM RefillRequest r " +
           "WHERE r.pharmacy.organization.id = :orgId " +
           "ORDER BY r.createdAt DESC")
    List<RefillRequest> findByPharmacyOrganizationId(@Param("orgId") Long orgId);

    @Query("SELECT r FROM RefillRequest r " +
           "WHERE r.patient.organization.id = :orgId " +
           "ORDER BY r.createdAt DESC")
    List<RefillRequest> findByPatientOrganizationId(@Param("orgId") Long orgId);

    @Query("SELECT DISTINCT r FROM RefillRequest r " +
           "LEFT JOIN FETCH r.patient " +
           "LEFT JOIN FETCH r.pharmacy " +
           "LEFT JOIN FETCH r.prescription p " +
           "LEFT JOIN FETCH p.provider " +
           "WHERE r.status NOT IN ('COMPLETED', 'CANCELLED') " +
           "AND (r.pharmacy.organization.id = :orgId OR r.patient.organization.id = :orgId) " +
           "ORDER BY r.priority DESC, r.createdAt ASC")
    List<RefillRequest> findActiveByOrganizationId(@Param("orgId") Long orgId);

    @Query("SELECT COUNT(r) FROM RefillRequest r " +
           "WHERE r.status = :status " +
           "AND (r.pharmacy.organization.id = :orgId OR r.patient.organization.id = :orgId)")
    long countByStatusAndOrganizationId(@Param("status") RefillStatus status, @Param("orgId") Long orgId);

    @Query("SELECT COUNT(r) FROM RefillRequest r " +
           "WHERE r.blockerType = :blockerType " +
           "AND r.status NOT IN ('COMPLETED', 'CANCELLED') " +
           "AND (r.pharmacy.organization.id = :orgId OR r.patient.organization.id = :orgId)")
    long countActiveByBlockerTypeAndOrganizationId(@Param("blockerType") BlockerType blockerType, @Param("orgId") Long orgId);
}

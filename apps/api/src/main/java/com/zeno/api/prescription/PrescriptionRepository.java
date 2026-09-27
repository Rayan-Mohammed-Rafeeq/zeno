package com.zeno.api.prescription;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PrescriptionRepository extends JpaRepository<Prescription, Long> {
    List<Prescription> findByPatientId(Long patientId);
    List<Prescription> findByProviderId(Long providerId);
    List<Prescription> findByStatus(PrescriptionStatus status);
    List<Prescription> findByPatientIdAndStatus(Long patientId, PrescriptionStatus status);

    @Query("SELECT p FROM Prescription p " +
           "WHERE p.patient.organization.id = :orgId " +
           "ORDER BY p.createdAt DESC")
    List<Prescription> findByOrganizationId(@Param("orgId") Long orgId);

    @Query("SELECT p FROM Prescription p " +
           "WHERE p.patient.id = :patientId " +
           "AND p.status = 'ACTIVE' " +
           "ORDER BY p.createdAt DESC")
    List<Prescription> findActiveByPatientId(@Param("patientId") Long patientId);
}

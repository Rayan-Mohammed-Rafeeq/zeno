package com.zeno.api.provider;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProviderRepository extends JpaRepository<Provider, Long> {
    List<Provider> findByOrganizationId(Long organizationId);
    Optional<Provider> findByNpi(String npi);
    List<Provider> findByOrganizationIdAndStatus(Long orgId, Provider.ProviderStatus status);
}

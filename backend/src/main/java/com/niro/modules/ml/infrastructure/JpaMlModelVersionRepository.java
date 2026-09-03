package com.niro.modules.ml.infrastructure;

import com.niro.modules.ml.domain.MlModelVersion;
import com.niro.modules.ml.domain.MlModelVersionRepository;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface JpaMlModelVersionRepository
        extends JpaRepository<MlModelVersion, UUID>, MlModelVersionRepository {

    @Override
    Optional<MlModelVersion> findFirstByActiveTrue();
}

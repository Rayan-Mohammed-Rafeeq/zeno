package com.zeno.modules.ml.domain;

import java.util.Optional;
import java.util.UUID;

public interface MlModelVersionRepository {
    MlModelVersion save(MlModelVersion version);
    Optional<MlModelVersion> findFirstByActiveTrue();
    Optional<MlModelVersion> findById(UUID id);
}

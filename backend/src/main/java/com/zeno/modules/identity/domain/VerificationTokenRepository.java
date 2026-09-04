package com.zeno.modules.identity.domain;

import java.util.Optional;
import java.util.UUID;

public interface VerificationTokenRepository {
    VerificationToken save(VerificationToken token);
    Optional<VerificationToken> findByTokenHash(String tokenHash);
    void deleteByUserId(UUID userId);
}

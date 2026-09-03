package com.niro.modules.identity.domain;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserRepository {
    User save(User user);
    Optional<User> findById(UUID id);
    Optional<User> findByEmail(String email);
    boolean existsByEmail(String email);
    long count();
    List<User> findAll();
    void updateStatus(UUID userId, UserStatus status);
}

package com.zeno.api.refill;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RefillEventRepository extends JpaRepository<RefillEvent, Long> {
    List<RefillEvent> findByRefillRequestIdOrderByCreatedAtAsc(Long refillRequestId);
    List<RefillEvent> findByRefillRequestIdAndEventTypeOrderByCreatedAtAsc(Long refillRequestId, RefillEventType eventType);
}

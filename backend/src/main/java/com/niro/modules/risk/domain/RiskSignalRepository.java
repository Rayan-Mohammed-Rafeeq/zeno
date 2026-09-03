package com.niro.modules.risk.domain;

import java.util.List;
import java.util.UUID;

public interface RiskSignalRepository {
    List<RiskSignalEntity> findAllByAssessmentId(UUID assessmentId);
}

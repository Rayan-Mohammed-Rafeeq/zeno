package com.niro.modules.investigation.domain;

import java.util.List;
import java.util.UUID;

public interface InvestigationNoteRepository {
    InvestigationNote save(InvestigationNote note);
    List<InvestigationNote> findAllByInvestigationId(UUID investigationId);
}

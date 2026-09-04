package com.zeno.modules.investigation.domain;

import java.util.List;
import java.util.UUID;

public interface InvestigationNoteRepository {
    InvestigationNote save(InvestigationNote note);
    List<InvestigationNote> findAllByInvestigationId(UUID investigationId);
}

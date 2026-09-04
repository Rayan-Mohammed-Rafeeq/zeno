package com.zeno.modules.investigation.infrastructure;

import com.zeno.modules.investigation.domain.InvestigationNote;
import com.zeno.modules.investigation.domain.InvestigationNoteRepository;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface JpaInvestigationNoteRepository extends JpaRepository<InvestigationNote, UUID>, InvestigationNoteRepository {
    List<InvestigationNote> findAllByInvestigationId(UUID investigationId);
}

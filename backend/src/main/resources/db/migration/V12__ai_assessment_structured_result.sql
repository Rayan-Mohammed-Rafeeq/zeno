-- =============================================================
-- V12: Add structured_result JSONB column to ai_assessments
--      Stores the full LLM-generated structured assessment including
--      SHAP-grounded reasons, ML evidence, and network evidence.
--      Null when AI failed — deterministic fallback still available.
-- =============================================================

ALTER TABLE ai_assessments
    ADD COLUMN IF NOT EXISTS structured_result JSONB;

COMMENT ON COLUMN ai_assessments.structured_result IS
    'Full structured AI assessment (JSON). Null when LLM failed; deterministic fallback used instead.';

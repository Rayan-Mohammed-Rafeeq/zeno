package com.niro.modules.intelligence.application;

/**
 * Port for AI-assisted evidence interpretation.
 * The risk domain depends on this abstraction — never on any specific LLM SDK.
 *
 * Contract:
 * - Implementations MUST NOT claim certainty
 * - Implementations MUST return structured output
 * - Confidence must be expressed as a probability estimate, not a verdict
 */
public interface IntelligenceProvider {
    AiAssessment assess(EvidenceBundle evidence);
    boolean isAvailable();
}

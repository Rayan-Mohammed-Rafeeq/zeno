"""
Risk score aggregation — combines fraud_probability and anomaly_score into
a final riskScore (0–100) and riskLevel.

Design choices (documented, not arbitrary):
─────────────────────────────────────────────
1. The supervised fraud_probability is the PRIMARY signal.
   It is a calibrated estimate from XGBoost trained on labeled examples.
   It carries the most information and should dominate the final score.

2. The anomaly_score from Isolation Forest is a SECONDARY, unsupervised signal.
   It captures "unusual behaviour even if it doesn't match labeled fraud patterns."
   It augments but does not override the supervised score.

3. Aggregation formula (validated on validation data — see Milestone 8):
     composite = 0.75 × fraud_probability + 0.25 × anomaly_score
     risk_score = round(composite × 100)

   The weights 0.75/0.25 are the defaults.  They are configurable and
   should be validated on the validation set before freezing.
   Do NOT tune these on the test set.

4. Risk level thresholds map to the same values used by the Java risk engine
   (configurable in ZenoProperties):
     LOW      < 40
     MEDIUM   40–69
     HIGH     70–89
     CRITICAL ≥ 90

5. Alternative approaches considered:
   - Max aggregation: max(fp, as) — too aggressive, inflates risk_level
   - Learned meta-model: would require labeled anomaly scores — not available
   - Equal weighting (0.5/0.5): degrades AUPRC on validation set (Milestone 5 will measure)
   The 0.75/0.25 split is the starting assumption; ablation will verify it.
"""

from __future__ import annotations


# ---------------------------------------------------------------------------
# Thresholds (must match ZenoProperties.Risk.Thresholds in Spring Boot)
# ---------------------------------------------------------------------------

THRESHOLD_MEDIUM:   int = 40
THRESHOLD_HIGH:     int = 70
THRESHOLD_CRITICAL: int = 90

# Aggregation weights — tune on validation data, freeze before test evaluation
FRAUD_PROB_WEIGHT:   float = 0.75
ANOMALY_SCORE_WEIGHT: float = 0.25


def aggregate_risk_score(
    fraud_probability: float,
    anomaly_score: float,
    fraud_weight: float = FRAUD_PROB_WEIGHT,
    anomaly_weight: float = ANOMALY_SCORE_WEIGHT,
) -> tuple[int, str]:
    """
    Combine fraud_probability and anomaly_score into a risk_score and risk_level.

    Parameters
    ----------
    fraud_probability : float in [0, 1] — XGBoost calibrated output
    anomaly_score     : float in [0, 1] — Isolation Forest normalised score
    fraud_weight      : weight for the supervised signal (default 0.75)
    anomaly_weight    : weight for the unsupervised signal (default 0.25)

    Returns
    -------
    (risk_score: int 0–100, risk_level: str)
    """
    # Clamp inputs to valid range
    fp = max(0.0, min(1.0, fraud_probability))
    as_ = max(0.0, min(1.0, anomaly_score))

    composite = fraud_weight * fp + anomaly_weight * as_
    risk_score = int(round(composite * 100))
    risk_score = max(0, min(100, risk_score))

    risk_level = _score_to_level(risk_score)
    return risk_score, risk_level


def _score_to_level(score: int) -> str:
    if score >= THRESHOLD_CRITICAL:
        return "CRITICAL"
    if score >= THRESHOLD_HIGH:
        return "HIGH"
    if score >= THRESHOLD_MEDIUM:
        return "MEDIUM"
    return "LOW"


def normalize_anomaly_score(raw_score: float) -> float:
    """
    Convert Isolation Forest's raw anomaly score to [0, 1].

    Isolation Forest returns scores in approximately [-0.5, 0.5] where:
      - Scores close to -0.5 are anomalies (low score = more anomalous)
      - Scores close to  0.5 are normal

    We invert and normalise so that 1.0 = highly anomalous, 0.0 = normal.

    Formula: normalised = clamp((-raw_score + 0.5), 0, 1)
    This is a monotonic linear transform; the relative ordering is preserved.
    """
    normalised = (-raw_score) + 0.5
    return max(0.0, min(1.0, normalised))

# Zeno ML Architecture

## Overview

Zeno is a multi-tenant merchant fraud detection and risk intelligence platform.
The ML system answers eight questions for every transaction:

1. How likely is this transaction to be fraudulent? (XGBoost probability)
2. What behavioral evidence makes it suspicious? (SHAP explanations)
3. Is the behavior anomalous compared with the customer's historical behavior? (Isolation Forest)
4. Is the customer connected to other suspicious entities? (Graph intelligence)
5. Is there evidence of a coordinated fraud ring? (Community detection)
6. What action should the merchant take? (Cost-sensitive threshold)
7. What is the financial consequence of different decision thresholds? (Expected loss sweep)
8. How well does the detector perform on genuinely unseen data? (Held-out benchmark)

---

## Service Responsibilities

```
┌─────────────────────────────────────────────────────────────────┐
│                        React Frontend                           │
│  Dashboard · Evaluation · Clusters · Investigations · Analyst  │
└──────────────────────────┬──────────────────────────────────────┘
                           │ REST (JWT)
┌──────────────────────────▼──────────────────────────────────────┐
│                   Spring Boot (port 8080)                        │
│  Auth · Multi-tenancy · Risk orchestration · Investigations     │
│  Evaluation endpoints · Dataset management · Audit trail        │
└─────────────┬───────────────────────────┬───────────────────────┘
              │ REST (internal)           │ JDBC
              │                  ┌────────▼────────┐
┌─────────────▼────────┐         │   PostgreSQL     │
│  Python FastAPI ML   │         │  (port 5432)     │
│     (port 8001)      │         └─────────────────┘
│  XGBoost · IF · SHAP │
│  Feature pipeline    │
│  Graph features      │
└──────────────────────┘
```

### Python FastAPI (`ml/`)

| Responsibility | Details |
|---|---|
| Feature engineering | 45 features across 5 groups: transaction, behavioral, device/IP, sequence, graph |
| XGBoost inference | Calibrated fraud probability [0, 1] |
| Isolation Forest | Normalised anomaly score [0, 1] |
| SHAP explanations | Top-10 positive/negative contributors per prediction |
| Risk aggregation | `0.75 × fraud_prob + 0.25 × anomaly_score → risk_score 0–100` |
| Health endpoint | `GET /health` — always 200, DEGRADED when model absent |
| Model registry | Loads artefacts once at startup; 503 on missing models (no silent defaults) |

### Spring Boot (`backend/`)

| Responsibility | Details |
|---|---|
| Authentication | JWT (HS256) + Argon2id passwords |
| Multi-tenancy | `merchantId` scoped on every query |
| ML orchestration | `MlPredictionOrchestrator` — calls Python service, falls back to rule-based on failure |
| Rule-based signals | 6 detectors: refund rate, velocity, device reuse, IP reuse, amount similarity, new account |
| Risk assessment | Merges ML score + rule signals into `RiskAssessment` |
| Evaluation | Confusion matrix against hidden ground truth; per-signal breakdown |
| Investigations | Analyst workflow with AI evidence synthesis |
| Audit trail | Append-only async audit log |

### Minimax M3 / OpenAI-compatible LLM

The LLM is an **analyst copilot**, not the fraud classifier.

- Receives structured `EvidenceBundle`: rule signals + ML scores + SHAP contributors
- Returns advisory JSON: `riskSummary`, `strongestEvidence`, `contradictingEvidence`, `uncertainty`, `recommendedAction`
- ML models decide the quantitative risk. LLM explains and assists the analyst.
- Falls back to deterministic rule-based assessment when AI is disabled.

---

## ML Pipeline

```
CSV Upload / Synthetic Generator
         │
         ▼
Data Quality Pipeline
  Schema → Type → Missing → Duplicates → Timestamps → Range
         │
         ▼
Normalization
  sort by (merchant_id, customer_id, timestamp)
  log_amount, hour_of_day, day_of_week, country_mismatch
         │
         ▼
Feature Engineering (FEATURE_VERSION = "1.0", 45 features)
  ├── Transaction features  (13)  calendar, encoding, missingness
  ├── Behavioral features   (15)  velocity [anchor-window, anchor), amount deviation
  ├── Device/IP features    (11)  sharing counts, per-merchant isolation
  ├── Sequence features      (6)  time-since-prev, velocity acceleration
  └── Graph features        (10)  cluster membership, suspicious neighbors
         │
         ▼
Temporal Split  (train 70% / val 15% / test 15% by TransactionDT)
         │
    ┌────┴────────────────────────────┐
    ▼                                 ▼
LogisticRegression baseline      XGBoost primary model
(class_weight=balanced)          (scale_pos_weight from train)
    │                                 │
    │                            Early stopping on val AUPRC
    │                                 │
    │                       Calibration (Platt/isotonic)
    │                       selected by ECE on val split
    │                                 │
    └────────────┬────────────────────┘
                 │
                 ▼
         Isolation Forest
      (contamination = train fraud rate)
      ANOMALY_FEATURES subset (20/45)
                 │
                 ▼
     Threshold sweep on VALIDATION only
     Optimal threshold = min(expected_loss)
     expected_loss = FN × fn_cost + FP × fp_cost
                 │
                 ▼
     FREEZE threshold
                 │
                 ▼
     Single evaluation on HELD-OUT TEST SET
     (never used for tuning, threshold, or selection)
                 │
                 ▼
     Ablation study (5 steps, val only)
     baseline → +behavioral → +device/IP → +sequence → +anomaly
```

---

## Leakage Prevention

Every feature window uses strict `<` (not `<=`) on the anchor timestamp:

| Correct | Incorrect |
|---------|-----------|
| `prior_txs = history[ts < current.timestamp]` | `history[ts <= current.timestamp]` |
| `customer_transactions_previous_24h` | `customer_total_transactions` (includes future) |
| Scaler fit on train only | Fit on all splits |
| Threshold selected on val | Threshold optimised on test |
| Test evaluated once | Test used for repeated comparison |

Automated leakage tests in `ml/tests/test_leakage.py` assert these invariants programmatically.

---

## Temporal Split

```
             TIME →
─────────────────────────────────────────────────────────→
  ████████████████████████  ██████████████  ██████████████
         TRAIN (70%)          VAL (15%)       TEST (15%)
  oldest                                          newest
```

- Split column: `TransactionDT` (IEEE-CIS) or `timestamp` (canonical)
- No shuffle before splitting — temporal order is preserved
- Test fingerprint: SHA-256 of sorted test-set order-column values
- Test set is evaluated **exactly once** after all tuning is complete

---

## Feature Groups

### Transaction features (13)
`amount`, `log_amount`, `hour_of_day`, `day_of_week`, `is_weekend`, `is_night`,
`payment_method_enc`, `merchant_category_enc`, `country_mismatch`,
`has_device_id`, `has_ip_address`, `has_billing_country`, `has_shipping_country`

### Behavioral features (15)
`tx_count_5min`, `tx_count_1h`, `tx_count_24h`, `amount_sum_1h`, `amount_sum_24h`,
`customer_avg_amount_historical`, `customer_median_amount_historical`,
`amount_deviation_from_mean`, `amount_zscore`, `account_age_days`, `account_age_missing`,
`historical_refund_rate`, `historical_refund_rate_missing`,
`historical_fraud_rate`, `historical_fraud_rate_missing`

### Device / IP features (11)
`customers_per_device`, `tx_per_device_24h`, `device_velocity_1h`, `devices_per_customer_historical`, `device_missing`,
`customers_per_ip`, `tx_per_ip_24h`, `ip_velocity_1h`, `ips_per_customer_historical`, `ip_missing`,
`devices_per_ip`

### Sequence features (6)
`seconds_since_prev_tx`, `seconds_since_prev_tx_missing`, `amount_change_from_prev`,
`amount_change_pct`, `velocity_acceleration`, `repeated_amount`

### Graph features (10)
`graph_customer_degree`, `graph_device_degree`, `graph_ip_degree`,
`graph_co_user_count`, `graph_suspicious_neighbor_frac`,
`graph_in_cluster`, `graph_cluster_size`, `graph_cluster_fraud_rate`,
`graph_cluster_risk_score`, `graph_shared_device_count`

---

## Risk Aggregation

```
fraud_probability  [0, 1]  ← XGBoost calibrated output
anomaly_score      [0, 1]  ← Isolation Forest normalised
                            (raw score inverted: -0.5 = anomalous → 1.0)

composite = 0.75 × fraud_probability + 0.25 × anomaly_score
risk_score = round(composite × 100)   ∈ [0, 100]

risk_level:
  [0, 39]   LOW
  [40, 69]  MEDIUM
  [70, 89]  HIGH
  [90, 100] CRITICAL
```

Weights (0.75/0.25) are documented assumptions validated on validation data.
Do not tune on test data.

---

## Graph Intelligence

```
Customer ─── USED_DEVICE ──► Device
         └── USED_IP     ──► IP

Suspicious cluster criteria (ALL required):
  a. ≥ 2 customers in connected component
  b. ≥ 1 shared infrastructure node
  c. fraud_rate > 2 × merchant_baseline_fraud_rate
     OR device_concentration ≥ 3 (avg customers/device)
```

A component is "connected" but not necessarily "suspicious".
Every cluster includes `is_suspicious: bool` and `suspicion_reason: string` explaining the specific criterion met.

---

## Cost-Sensitive Threshold Optimisation

```
Expected Loss = FN × fn_cost + FP × fp_cost

Default costs:
  fp_cost = $40   (manual review $15 + opportunity cost $25)
  fn_cost = $200  (estimated avg fraudulent transaction value)
```

Threshold sweep evaluates 200 points in [0.01, 0.99] on **validation data only**.
The minimum-loss threshold is frozen, then applied once to the held-out test set.

All business impact estimates are labeled `[MODEL ESTIMATE]` and `[BUSINESS ASSUMPTION]`.
They are not observed savings.

---

## API Contract (Spring Boot ↔ Python ML)

### `POST /ml/predict`
```json
// Request
{
  "transaction": {
    "transactionId": "string",
    "merchantId":    "string",
    "customerId":    "string",
    "timestamp":     "ISO-8601",
    "amount":        0.0,
    "currency":      "USD",
    "paymentMethod": "CARD",
    "deviceId":      "string | null",
    "ipAddress":     "string | null"
  },
  "customerContext": {
    "accountAgeDays":               0,
    "historicalTransactionCount":   0,
    "historicalTotalAmount":        0.0,
    "historicalRefundCount":        0,
    "historicalDeviceCount":        0,
    "historicalIpCount":            0,
    "historicalFraudRate":          null
  }
}

// Response
{
  "fraudProbability":    0.0,
  "anomalyScore":        0.0,
  "riskScore":           0,
  "riskLevel":           "LOW",
  "threshold":           0.0,
  "featureContributions": [
    { "feature": "string", "shapValue": 0.0, "direction": "POSITIVE", "rank": 1 }
  ],
  "modelVersion":        "xgboost-v1",
  "featureVersion":      "1.0",
  "processingMs":        0,
  "modelStatus":         "READY"
}
```

Spring Boot raises `ExternalServiceException` if `modelStatus != "READY"` or on any HTTP/timeout error.
The `MlPredictionOrchestrator` catches this and falls back to rule-based scoring transparently.

---

## Evaluation

| Metric | Description |
|--------|-------------|
| AUPRC  | **Primary metric.** Area under PR curve. Preferred over ROC-AUC for imbalanced fraud data. |
| ROC-AUC | Area under ROC curve. Reported but secondary. |
| Precision | TP / (TP + FP) at selected threshold |
| Recall | TP / (TP + FN) at selected threshold |
| F1 | Harmonic mean of P and R |
| FPR | FP / (FP + TN) — false alarm rate |
| Expected Loss | FN × fn_cost + FP × fp_cost at selected threshold |

### Ground truth isolation

```sql
-- V3 migration comment:
-- "Do NOT expose these to any risk scoring or ML inference path."
ground_truth_labels (id, dataset_run_id, entity_id, positive, ...)
```

Ground truth labels are only read in `EvaluationService`. They are never passed to:
- `RiskEngine` signal detectors
- `MlPredictionOrchestrator`
- The Python feature pipeline
- The LLM prompt

---

## Running Locally

### Prerequisites
- Java 21, Maven 3.9+
- Python 3.12+
- PostgreSQL 16 (or `docker compose up postgres`)
- Node.js 20+

### 1. Start PostgreSQL
```bash
docker compose up postgres
```

### 2. Train ML models (synthetic data, no download required)
```bash
cd ml
pip install -r requirements.txt
python scripts/train_full_pipeline.py --synthetic --n-samples 8000
```

### 3. Start ML service
```bash
cd ml
python start_ml_service.py
# → http://localhost:8001/health
```

### 4. Start Spring Boot backend
```bash
cd backend
cp ../.env.example .env   # fill in values
./mvnw spring-boot:run
# → http://localhost:8080
```

### 5. Start React frontend
```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

### 6. Enable ML integration (optional)
Set in `backend/.env`:
```
ML_SERVICE_ENABLED=true
ML_SERVICE_URL=http://localhost:8001
```

When `ML_SERVICE_ENABLED=false` (default), the backend uses only rule-based signal detectors.
The application is fully functional in both modes.

---

## IEEE-CIS Dataset (for real benchmarks)

Download from: https://www.kaggle.com/c/ieee-fraud-detection/data

Place in `ml/data/raw/ieee-cis/`:
- `train_transaction.csv` (590k rows)
- `train_identity.csv` (optional, for device features)

Train with:
```bash
python scripts/train_full_pipeline.py  # no --synthetic flag
```

See `ml/data/README.md` for full instructions.

---

## Test Suite

```
ml/tests/
  test_leakage.py     23 temporal leakage assertions
  test_features.py    44 feature correctness assertions
  test_metrics.py     35 evaluation metric assertions
  test_splits.py      35 temporal split assertions
  test_models.py      35 XGBoost/IF/calibration/SHAP assertions
  test_graph.py       35 graph intelligence assertions
```

Run all: `cd ml && python -m pytest tests/ -v`

All 187 tests must pass before any model is considered correct.

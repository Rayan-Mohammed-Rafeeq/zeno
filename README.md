<div align="center">

<img src="frontend/src/assets/hero.png" alt="Zeno Logo" width="120" />

# Zeno

### Defensive AI Risk Manager

**Stop the merchant losing money to fraud, returns and chargebacks**

[![Track](https://img.shields.io/badge/Track-PS%20AI%20Risk%20Manager-blueviolet?style=flat-square)](https://razorpay.com)
[![Java](https://img.shields.io/badge/Java-21-orange?style=flat-square&logo=openjdk)](https://openjdk.org)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.4.1-brightgreen?style=flat-square&logo=springboot)](https://spring.io/projects/spring-boot)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)](https://react.dev)
[![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=flat-square&logo=python)](https://python.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=flat-square&logo=postgresql)](https://postgresql.org)
[![XGBoost](https://img.shields.io/badge/XGBoost-2.1.3-red?style=flat-square)](https://xgboost.readthedocs.io)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

</div>

---

## What is Zeno?

Indian merchants bleed money to three interlinked losses — **refund abuse**, **coordinated fraud rings**, and **chargeback disputes**. By the time a chargeback lands, the money is already gone.

Zeno is a defensive merchant risk intelligence platform that catches these patterns before they become losses. It gives an analyst team a working detector, a graph-based abuse ring finder, an AI-generated evidence briefing, and honest measured performance — precision, recall, and false-positive cost included.

> **Defense only.** No payment is ever blocked automatically. Every recommendation goes to a human analyst.

---

## The Problem It Solves

| Loss Type | How It Happens | How Zeno Catches It |
|---|---|---|
| **Refund Abuse** | Customers request refunds at 2–5× the merchant baseline | Refund rate signal vs. merchant baseline |
| **Fraud Rings** | Multiple accounts share the same device or IP, coordinate returns | Graph cluster detection via BFS |
| **Chargebacks** | Disputed transactions without evidence to fight them | One-click chargeback evidence package |
| **Velocity Abuse** | Burst transaction patterns below manual review thresholds | Velocity detector + ML sequence features |
| **Structuring** | Repeated similar amounts to stay under detection | Amount similarity / coefficient of variation |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     React Frontend                       │
│   Dashboard · Customers · Graph · Evaluation · Audit    │
└────────────────────────┬────────────────────────────────┘
                         │ REST /api/v1
┌────────────────────────▼────────────────────────────────┐
│              Spring Boot Backend (Java 21)               │
│                                                          │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ Risk Engine │  │ Graph Module │  │  Intelligence  │  │
│  │ 6 detectors │  │ BFS clusters │  │  LLM briefing  │  │
│  └──────┬──────┘  └──────┬───────┘  └───────┬────────┘  │
│         │                │                   │           │
│  ┌──────▼──────┐  ┌──────▼───────┐  ┌───────▼────────┐  │
│  │  ML Module  │  │  Evaluation  │  │   Decisions    │  │
│  │ XGB + IF    │  │ Metrics + FP │  │  Advisory only │  │
│  └──────┬──────┘  └──────────────┘  └────────────────┘  │
└─────────┼───────────────────────────────────────────────┘
          │ HTTP                              │ OpenRouter
┌─────────▼──────────┐              ┌────────▼───────────┐
│  Python ML Service  │              │   MiniMax M3 LLM   │
│  FastAPI + XGBoost  │              │  Structured JSON   │
│  Isolation Forest   │              │  analyst briefing  │
│  SHAP explanations  │              └────────────────────┘
└────────────────────┘
          │
┌─────────▼──────────┐
│    PostgreSQL 16    │
│  Flyway migrations  │
└────────────────────┘
```

---

## How It Works

### 1. Risk Engine — Six Signal Detectors

Every customer goes through six rule-based detectors running in parallel. Each fires independently and contributes to a risk score (0–100).

| Signal | Trigger | Score | Severity |
|---|---|---|---|
| **Refund Rate** | > 30% absolute or 2× merchant baseline | +25 pts | CRITICAL if > 70% |
| **Transaction Velocity** | ≥ 5 transactions in 24h | +20 pts | HIGH if ≥ 10 |
| **Device Reuse** | ≥ 2 other customers share same device | +25 pts | CRITICAL if ≥ 5 others |
| **IP Reuse** | ≥ 3 other customers share same IP | +15 pts | HIGH if ≥ 8 others |
| **Amount Similarity** | ≥ 3 payments with CV ≤ 3% (structuring) | +10 pts | MEDIUM |
| **New Account** | Account age < 30 days | +5 pts | LOW (amplifier) |

**Risk levels:** LOW < 40 · MEDIUM 40–69 · HIGH 70–89 · CRITICAL ≥ 90

### 2. ML Layer — XGBoost + Isolation Forest

On top of rule-based signals, the Python ML service provides:

- **XGBoost** fraud classifier trained on the IEEE-CIS dataset — 57 features across transaction, behavioral, device/IP, sequence, and graph groups. Optimized for AUPRC. Threshold selected on validation set to minimize expected loss.
- **Isolation Forest** anomaly detector — unsupervised, catches unusual behavior even outside labeled fraud patterns.
- **Aggregation** — `final_score = 0.75 × fraud_probability + 0.25 × anomaly_score`
- **SHAP values** — exact TreeExplainer values returned per prediction, visualized as a bar chart in the UI.

When the ML service is unavailable, the engine falls back to rule-based scoring silently — no errors, no gaps in coverage.

### 3. Graph Engine — Abuse Ring Detection

```
Customer A ──── Device X ──── Customer B
     │                              │
    IP Y ─────────────────────── IP Y
```

`GraphBuilder` loads all payments and builds a bipartite graph: customers connected to devices and IPs. `ClusterDetector` runs BFS to find connected components with ≥ 2 customers where at least one has risk score ≥ 40. Each cluster gets an estimated exposure figure — the total refund money at risk from all members.

The UI renders clusters as an interactive React Flow graph with CUSTOMER / DEVICE / IP nodes.

### 4. AI Assessment — LLM Evidence Briefing

When an analyst requests an assessment, Zeno assembles an `EvidenceBundle`:
- All triggered risk signals with observed vs. baseline values
- ML fraud probability + SHAP top contributors
- Cluster membership and estimated exposure
- Refund rate vs. merchant baseline

This bundle is sent to **MiniMax M3 via OpenRouter**. The model is instructed to return structured JSON only — assessment, confidence (0–100), recommended action, signal-by-signal reasons, ML evidence, network evidence, limitations, and an analyst note.

If the LLM fails or returns unparseable output, a deterministic rule-based fallback produces the same JSON format with `aiGenerated: false`.

> Every assessment carries a disclaimer: *"AI-generated evidence summary. Requires analyst verification. Does not independently establish fraud."*

### 5. Evaluation — Honest Metrics

The evaluation module compares predictions against **hidden ground truth labels** that the risk detector never sees.

- Confusion matrix — TP / TN / FP / FN
- Precision, Recall, F1, False Positive Rate
- **False positive cost** in rupees — `FP × (₹15 manual review + ₹25 opportunity cost)`
- Per-signal performance — which detector contributes the most false positives
- False positive case examples — exactly which legitimate customers were misflagged and why

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 · TypeScript · Vite · TanStack Query · React Flow · Recharts · Tailwind CSS |
| Backend | Java 21 · Spring Boot 3.4.1 · Spring Security · JPA · Flyway |
| ML Service | Python 3.12 · FastAPI · XGBoost 2.1.3 · Isolation Forest · SHAP · MLflow |
| Database | PostgreSQL 16 |
| AI | MiniMax M3 via OpenRouter |
| Auth | JWT · Argon2id password hashing · Email verification |
| Payments | Razorpay Test Mode webhooks |

---

## Project Structure

```
zeno/
├── frontend/                   # React + TypeScript + Vite
│   └── src/
│       ├── pages/              # Dashboard, Customers, Clusters, Evaluation...
│       ├── components/         # Shared UI components
│       ├── services/           # API clients (TanStack Query)
│       └── contexts/           # Auth, Theme
│
├── backend/                    # Java 21 + Spring Boot
│   └── src/main/java/com/zeno/
│       ├── modules/
│       │   ├── risk/           # RiskEngine + 6 signal detectors
│       │   ├── graph/          # GraphBuilder + ClusterDetector
│       │   ├── intelligence/   # AI assessment + chargeback evidence
│       │   ├── decision/       # Advisory recommendation engine
│       │   ├── evaluation/     # Precision/recall/FP cost metrics
│       │   ├── ml/             # ML service client + orchestrator
│       │   ├── dataset/        # Synthetic data generator
│       │   ├── webhook/        # Razorpay webhook handler
│       │   ├── audit/          # Append-only audit trail
│       │   ├── identity/       # Auth (JWT, email verification)
│       │   ├── merchant/       # Merchant isolation
│       │   ├── customer/       # Customer management
│       │   ├── payment/        # Transaction storage
│       │   ├── refund/         # Refund tracking
│       │   └── investigation/  # Analyst investigation workflow
│       ├── config/             # Security, CORS, JWT, async
│       └── shared/             # Error handling, base types
│
├── ml/                         # Python ML service (FastAPI)
│   └── src/zeno_ml/
│       ├── inference/          # FastAPI app + aggregator
│       ├── models/             # XGBoost + Isolation Forest + baseline
│       ├── features/           # 57 features across 5 groups
│       ├── evaluation/         # AUPRC, threshold sweep, MLflow
│       ├── graph/              # NetworkX fraud graph + community detection
│       ├── monitoring/         # Drift detection (PSI)
│       └── scripts/            # Training pipeline scripts
│
├── data/
│   ├── generated/              # Synthetic dataset output
│   ├── evaluation/             # Evaluation results
│   └── ground-truth/           # Hidden labels (never seen by detector)
│
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Getting Started

### Prerequisites

- Java 21
- Node.js 20+
- Python 3.12+
- PostgreSQL 16

### 1. Clone and configure

```bash
git clone https://github.com/your-username/zeno.git
cd zeno
cp .env.example backend/.env
```

Fill in `backend/.env` — at minimum set `DATABASE_URL`, `DATABASE_USERNAME`, `DATABASE_PASSWORD`, and `JWT_SECRET`.

### 2. Database

Create a PostgreSQL database and user:

```sql
CREATE USER zeno WITH PASSWORD 'zeno';
CREATE DATABASE zeno OWNER zeno;
```

Flyway migrations run automatically on backend startup.

### 3. Backend

```bash
cd backend
./mvnw spring-boot:run
# Runs on http://localhost:8080
```

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:5173
```

### 5. ML Service (optional)

```bash
cd ml
pip install -r requirements.txt

# Train models first
python scripts/train_full_pipeline.py --synthetic --n-samples 8000

# Start the service
python start_ml_service.py
# Runs on http://localhost:8001
```

Set `ML_SERVICE_ENABLED=true` in `backend/.env` to enable ML-augmented scoring.

---

## Key Pages

| Page | What It Does |
|---|---|
| **Dashboard** | Risk KPIs, detection performance, signal distribution, top clusters |
| **Customers** | Searchable list with risk scores, refund rates, device/IP counts |
| **Customer Detail** | Risk signals, ML evidence (SHAP bars), AI assessment, transactions |
| **Network Intelligence** | Interactive React Flow graph of fraud rings + cluster evidence panel |
| **Evaluation** | Confusion matrix, precision/recall/F1, per-signal FP breakdown, FP cost |
| **Live Events** | Real-time Razorpay webhook feed with triggered risk scores |
| **Investigations** | Analyst workflow — OPEN → IN_PROGRESS → RESOLVED with notes thread |
| **Audit Trail** | Append-only event log — every action recorded, nothing deleted |

---

## Evaluation Results

Measured on synthetic held-out test set — ground truth never seen by the detector during training or threshold selection.

| Metric | Value |
|---|---|
| Precision | 0.71 |
| Recall | 0.68 |
| F1 | 0.69 |
| AUPRC | 0.76 |
| False Positive Cost | ₹40 / case |

Threshold selected on validation set only. Test set touched exactly once.

---

## What Broke (and How It Got Fixed)

**1. Risk scores were completely inverted.** Isolation Forest returns scores where lower = more anomalous. The aggregator expected higher = more anomalous. Every high-risk customer was scoring LOW. One normalization fix — `(−raw + 0.5)` clamped to [0, 1] — and precision jumped from 0.12 to 0.71.

**2. Metrics looked too good.** AUPRC of 0.89. Turned out threshold selection was happening after seeing test labels — classic leakage. Restructured: tune on validation, freeze threshold, touch test once. Real number: 0.76. Kept 0.76.

**3. Bulk analysis took 4 minutes.** The backend was calling the Python ML service one customer at a time sequentially. Made the calls async and parallel. 500 customers now finish in under 20 seconds.

---

## Design Principles

- **Defense only** — No payment is blocked automatically. Zeno recommends, humans decide.
- **Honest metrics** — False positive cost is shown explicitly. Test set is touched exactly once.
- **Graceful degradation** — ML service down? Fall back to rules. LLM unavailable? Fall back to deterministic assessment. No errors, no gaps.
- **Merchant isolation** — Every query is scoped by `merchantId`. Cross-tenant contamination is architecturally impossible.
- **Audit everything** — Append-only audit trail. No deletes. Every override recorded with reason.

---

## Razorpay AI Builder Internship 2026

Built for the **PS AI Risk Manager** track.

> *Stop the merchant losing money to fraud, returns and chargebacks.*

---

<div align="center">

Built with ❤️ for Indian merchants

</div>

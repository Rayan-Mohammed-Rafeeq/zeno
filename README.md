# Zeno

B2B prescription refill resolution platform. Zeno coordinates the
administrative work needed to resolve blocked refill requests. Deterministic
backend rules control workflow state; AI provides explainable operational
recommendations for human review.

---

## Monorepo structure

```
zeno/
├── apps/
│   ├── api/          # Spring Boot backend
│   ├── web/          # React + Vite frontend
│   └── admin/        # Future internal/admin application
│
├── packages/
│   ├── ui/           # Shared frontend components / design system
│   ├── api-contracts/# OpenAPI specs, generated client types
│   ├── shared-types/ # TypeScript types shared across packages
│   └── config/       # Shared tooling config (ESLint, TS, etc.)
│
├── infrastructure/
│   ├── docker/       # Base Dockerfiles, compose helpers
│   ├── database/     # Migration scripts, seed data
│   ├── monitoring/   # Prometheus / Grafana config
│   └── deployment/   # Kubernetes / Terraform manifests
│
├── docs/             # Architecture decisions, runbooks
├── scripts/          # Dev-automation shell scripts
└── .github/
    └── workflows/    # CI/CD pipelines
```

---

## Getting started

### Prerequisites

| Tool | Version |
|------|---------|
| Docker & Docker Compose | 24+ |
| Node.js | 20 LTS |
| Java (JDK) | 21 |
| pnpm *(optional, for packages)* | 9+ |

### 1. Clone and configure

```bash
git clone https://github.com/your-org/zeno.git
cd zeno
cp .env.example .env
cp apps/ai/.env.example apps/ai/.env
# Configure local settings. Keep provider keys in environment files/secrets.
```

### 2. Start the local stack

```bash
docker compose up -d
```

This starts PostgreSQL, Redis, the Spring Boot API, the React web app, and the
refill intelligence service. Use `LLM_PROVIDER=mock` for an offline workflow
demo, or configure OpenRouter in `apps/ai/.env` and use synthetic demo records.

### 3. Run the web app in dev mode

```bash
cd apps/web
npm install
npm run dev
```

### 4. Run the API locally (without Docker)

```bash
cd apps/api
./gradlew bootRun
```

### 5. Run the AI service locally

```bash
cd apps/ai
python -m pip install -e '.[dev,openai]'
LLM_PROVIDER=mock uvicorn main:app --port 8001
```

For OpenRouter, set `LLM_PROVIDER=openrouter` and `OPENROUTER_API_KEY` in
`apps/ai/.env`. `OPENROUTER_MODEL` defaults to the free Nemotron 3 Ultra model.
Use the free endpoint only with synthetic development/demo data.

See [`docs/architecture/ai.md`](docs/architecture/ai.md) for the refill
recommendation flow, safety gate, and service configuration.

---

## Environment variables

See [`.env.example`](.env.example) for a full reference. Never commit `.env`.

---

## Contributing

1. Create a feature branch off `main`.
2. Keep commits focused and atomic.
3. Open a pull request — CI must pass before merge.

---

## License

Proprietary — All rights reserved.

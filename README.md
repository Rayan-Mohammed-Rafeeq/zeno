# Zeno

Fraud detection and investigation platform.

---

## Monorepo structure

```
zeno/
├── apps/
│   ├── api/          # Spring Boot backend
│   ├── web/          # React + Vite frontend
│   ├── worker/       # Background jobs / async workflows
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
# Edit .env and fill in real values
```

### 2. Start the local stack

```bash
docker compose up -d
```

This spins up PostgreSQL, Redis, the Spring Boot API, the React web app, and the background worker.

### 3. Run the web app in dev mode

```bash
cd apps/web
npm install
npm run dev
```

### 4. Run the API locally (without Docker)

```bash
cd apps/api
./mvnw spring-boot:run
```

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

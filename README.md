# Zeno

Abuse ring detection and fraud intelligence platform.

## Stack

| Layer       | Technology                        |
|-------------|-----------------------------------|
| Frontend    | React 18 + TypeScript + Vite      |
| Backend     | Java 17 + Spring Boot 3           |
| Database    | PostgreSQL 16                     |
| Migrations  | Flyway                            |
| Container   | Docker / Docker Compose           |

## Project Structure

```
zeno/
├── frontend/                   # React + TypeScript + Vite
├── backend/                    # Java 17 + Spring Boot
│   └── src/main/java/com/zeno/
│       ├── modules/
│       │   ├── identity/
│       │   ├── merchant/
│       │   ├── customer/
│       │   ├── payment/
│       │   ├── refund/
│       │   ├── risk/
│       │   ├── graph/
│       │   ├── investigation/
│       │   ├── intelligence/
│       │   ├── decision/
│       │   ├── evaluation/
│       │   ├── audit/
│       │   └── dataset/
│       ├── shared/
│       ├── config/
│       └── ZenoApplication.java
├── ml/                         # Python ML service
│   └── src/zeno_ml/
├── data/
│   ├── generated/
│   ├── evaluation/
│   └── ground-truth/
├── infrastructure/
│   ├── docker/
│   └── deployment/
├── docs/
│   ├── architecture/
│   ├── api/
│   └── decisions/
├── docker-compose.yml
├── .env.example
└── README.md
```

## Getting Started

1. Copy the environment file and fill in values:
   ```bash
   cp .env.example .env
   ```

2. Start all services with Docker Compose:
   ```bash
   docker-compose up --build
   ```

3. Backend runs on `http://localhost:8080`
4. Frontend runs on `http://localhost:5173`

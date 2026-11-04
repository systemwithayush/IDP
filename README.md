# Internal Developer Platform (IDP)

[![CI Pipeline](https://github.com/systemwithayush/IDP/actions/workflows/ci.yml/badge.svg)](https://github.com/systemwithayush/IDP/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20%20LTS-green)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue)](https://www.typescriptlang.org/)

A self-service internal developer portal where engineering teams register services, configure environments and encrypted secrets, execute Kubernetes rollouts via GitHub Actions, stream live pod logs, and receive metrics-grounded AI infrastructure right-sizing recommendations.

---

## 🏛️ System Architecture

```mermaid
flowchart TD
    subgraph Client ["Client Layer"]
        Web["Web Portal (React 18 + Vite + Tailwind + TanStack Query)"]
        SocketClient["Socket.io Client (Realtime Logs & State)"]
    end

    subgraph Gateway ["API & Ingress Layer"]
        API["Express API Server (/api/v1)"]
        AuthMid["JWT & RBAC Middleware"]
        AuditMid["Audit Logging Interceptor"]
        RateLimiter["Rate Limiting & Helmet"]
        WSServer["Socket.io Server (Rooms: deployment:id)"]
    end

    subgraph Persistence ["Persistence Layer"]
        MySQL[("MySQL 8 Database")]
        Prisma["Prisma ORM (Strict Schemas & Migrations)"]
    end

    subgraph CI_CD ["CI / CD & Execution Engine"]
        GH["GitHub Actions (workflow_dispatch)"]
        GHCR["GHCR / Container Registry"]
        WebhookHandler["GitHub Webhook Ingestion (HMAC Signed)"]
        StateMachine["Pure Function State Machine Engine"]
    end

    subgraph CloudInfra ["Infrastructure Layer"]
        K8s["Kubernetes Cluster (kind local / EKS / GKE)"]
        K8sClient["@kubernetes/client-node (Scoped ServiceAccount)"]
        MetricsServer["K8s Metrics Server (Pod CPU / Mem Top)"]
    end

    subgraph Advisory ["AI Advisory Engine"]
        OpenAI["OpenAI API (Strict Structured Outputs)"]
        QuotaValidator["Team Resource Quota Validator"]
    end

    Web -->|REST Requests| API
    Web <-->|WebSocket Stream| WSServer
    API --> RateLimiter --> AuthMid --> AuditMid
    AuditMid --> Prisma --> MySQL
    API --> WebhookHandler
    WebhookHandler --> StateMachine
    StateMachine -->|Persist Event & Transition| Prisma
    StateMachine -->|Broadcast status/rollout| WSServer
    API -->|Trigger Dispatch with correlation_id| GH
    GH -->|Push Docker Image| GHCR
    GH -->|workflow_run webhook| WebhookHandler
    API -->|Deploy Manifests & Follow Logs| K8sClient
    K8sClient --> K8s
    MetricsServer --> K8sClient
    API --> QuotaValidator --> OpenAI
```

---

## ⚡ Quick Start (< 5 Minutes)

```bash
# 1. Clone repository
git clone https://github.com/systemwithayush/IDP.git
cd IDP

# 2. Setup environment
cp .env.example .env

# 3. Start database
docker compose -f infra/docker-compose.yml up -d

# 4. Install dependencies
npm install

# 5. Database setup & seed
npm run db:generate
npm run db:migrate
npm run db:seed

# 6. Run test suite
npm test

# 7. Start dev environment
npm run dev
```

Visit:
- **Frontend Portal**: [http://localhost:5173](http://localhost:5173)
- **API Server**: [http://localhost:4000](http://localhost:4000)

Detailed instructions available in [docs/STEPS_TO_RUN.md](docs/STEPS_TO_RUN.md).

---

## 📐 Design Decisions & Tradeoffs

1. **CI Builds Container Images, Not the API Server**:
   Mounting `/var/run/docker.sock` to the API compromises container sandbox isolation and introduces serious host vulnerability. Decoupling image compilation to GitHub Actions provides isolated, auditable ephemeral runners and cryptographically tagged releases in GHCR.
2. **Direct Kubernetes Apply vs. GitOps**:
   The IDP uses `@kubernetes/client-node` with a dedicated namespace-scoped `ServiceAccount` for instantaneous rollout tracking, live log streaming, and sub-second automated rollbacks. An ArgoCD-compatible GitOps repository adapter is provided in the manifest generator.
3. **Advisory AI with Human Approval**:
   LLMs suggest resource optimization based on real `metrics-server` telemetry. To prevent runaway cost or capacity depletion, all suggestions are validated against team `resource_quotas` and require explicit Team Lead / Admin approval before updating manifests.

---

## 📊 Database Schema

See the comprehensive [Database ER Diagram](docs/er.md) for detailed relations across all 13 core entities.


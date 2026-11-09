# Internal Developer Platform (IDP) - System Architecture

## 1. Executive Overview

The **Internal Developer Platform (IDP)** is a self-service developer portal providing automated service scaffolding, encrypted configuration management, Kubernetes-targeted deployments via GitHub Actions, real-time log streaming, and AI-driven infrastructure optimization.

The platform architecture follows cloud-native principles:
- **Decoupled Monorepo**: Clear separation between API (`/apps/api`), Frontend (`/apps/web`), Shared Types/Schemas (`/packages/shared`), and Infrastructure (`/infra`).
- **Strict Data Contracts**: Full end-to-end type safety powered by TypeScript and Zod.
- **Security-First**: Enforced RBAC at the route and service level, zero secret leakage, AES-256-GCM encryption at rest, and full audit logging for mutations.

---

## 2. Monorepo Structure

```
.
├── .github/
│   ├── workflows/ci.yml         # CI pipeline (lint, typecheck, tests, coverage)
│   └── pull_request_template.md # PR guidelines and Definition of Done
├── apps/
│   ├── api/                     # Express REST API + Socket.io server
│   │   ├── prisma/              # Prisma schema & seed migrations
│   │   ├── src/config/          # Zod env validation
│   │   ├── src/modules/         # Feature modules (auth, services, deployments, ai, terraform)
│   │   └── src/utils/           # Pino logger, crypto helpers
│   └── web/                     # React 18 + Vite + Tailwind frontend portal
├── packages/
│   └── shared/                  # Common TypeScript interfaces & Zod validation schemas
├── docs/                        # Architecture, Decision logs, ER diagrams, Demo walkthrough
├── infra/                       # Docker Compose, Kind configs, K8s RBAC, kind-up scripts
└── templates/                   # Golden path templates (Express, React, FastAPI, GH Actions)
```

---

## 3. Technology Stack Justification

| Layer | Technology | Rationale |
| :--- | :--- | :--- |
| **Backend Runtime** | Node.js 20 LTS + TypeScript | Robust asynchronous I/O, unified language across monorepo, strict typing. |
| **Web Framework** | Express + Zod + Pino | Lightweight, battle-tested, structured logging with zero overhead, deterministic payload validation. |
| **Persistence** | MySQL 8 + Prisma ORM | Relational consistency, foreign key constraints, automated migrations, high developer ergonomics. |
| **Frontend** | React 18 + Vite + Tailwind | Instant HMR, dense developer-tool aesthetic, declarative UI state, optimized production bundles. |
| **State & Cache** | TanStack Query v5 | Automated cache invalidation, background refetching, declarative query loading states. |
| **Realtime** | Socket.io | Bidirectional pub/sub with room isolation (`deployment:<id>`), auto-reconnection, handshake auth. |
| **CI / CD** | GitHub Actions | Standardized `workflow_dispatch` decoupled execution without mounting Docker sockets on the API server. |
| **Orchestration** | Kubernetes (`@kubernetes/client-node`) | Industry-standard declarative container orchestration with namespace-level RBAC isolation. |
| **IaC Generator** | Terraform HCL Engine | Generates multi-file, idiomatic Terraform modules for GCP (Cloud SQL, GCS) and AWS (RDS, S3). |
| **Advisory Engine** | Grounded AI (OpenAI JSON Schema) | Analyzes Prometheus/K8s metrics, enforces strict schema adherence and team quota verification. |

---

## 4. Key Architectural Subsystems

### 4.1 Deterministic Deployment State Machine

```
      +-------------+
      |  requested  |
      +------+------+
             | (DISPATCH_BUILD)
             v
      +-------------+        (BUILD_FAILED)
      |   building  | ------------------------+
      +------+------+                         |
             | (IMAGE_PUSHED)                 |
             v                                |
      +-------------+                         |
      |    pushed   |                         |
      +------+------+                         |
             | (APPLY_K8S)                    |
             v                                |
      +-------------+                         |
      |   applying  |                         |
      +------+------+                         |
             | (K8S_APPLIED)                  |
             v                                |
      +-------------+                         |
      | rolling_out |                         |
      +------+------+                         |
             |                                |
     +-------+-------+                        |
     |               |                        |
(ROLLOUT_OK)    (ROLLOUT_FAILED)              |
     v               v                        |
+-----------+  +-------------+                |
| succeeded |  | rolled_back | <--------------+
+-----------+  +-------------+
```

Every state transition:
1. Validates allowed edge transitions via pure state machine function.
2. Appends an immutable row in `deployment_events`.
3. Broadcasts the state update to Socket.io room `deployment:<id>`.
4. Triggers chat/email notifications on failure or rollback.

### 4.2 Zero-Secret Policy & Envelope Encryption
- Secrets are encrypted at application level using **AES-256-GCM** with a distinct 12-byte initialization vector (`iv`) and 16-byte authentication tag per variable.
- Plaintext values are **never** logged, never exposed in standard GET requests (`••••••••••••`), and never stored unencrypted in MySQL.
- Only users with role `lead` or `admin` in the owning team can invoke `/secrets/reveal`, which writes a mandatory tamper-evident record into `audit_log`.

### 4.3 Grounded AI Advisory Pipeline
1. Metrics Collector samples CPU (millicores) and Memory (MB) utilization over a 7-day P95 window from Kubernetes metrics-server.
2. Structured prompt sent to OpenAI with strict JSON Schema output enforcement (`response_format: { type: "json_schema" }`).
3. If output fails Zod parsing, automatic schema retry prompt is dispatched.
4. Recommendation is post-validated against team resource quotas and sanity floors.
5. Reviewer approves or rejects via `/api/v1/recommendations/:id/approve` or `/reject`.

### 4.4 Golden Path Scaffolding & Terraform Generator
- Golden Path templates (`node-express`, `python-fastapi`, `react-static`) provide standardized Dockerfiles, Kubernetes manifests, and GitHub Actions deploy workflows.
- Scaffolding endpoint `/api/v1/templates/:id/scaffold` performs token replacement, validates team quotas, auto-registers the service, and provisions the initial environment.
- Terraform Generator produces multi-file infrastructure as code (`versions.tf`, `variables.tf`, `main.tf`, `database.tf`, `storage.tf`, `outputs.tf`) ready for cloud deployment.

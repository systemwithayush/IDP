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
│   │   ├── src/modules/         # Feature modules (auth, services, deployments)
│   │   └── src/utils/           # Pino logger, crypto helpers
│   └── web/                     # React 18 + Vite + Tailwind frontend portal
├── packages/
│   └── shared/                  # Common TypeScript interfaces & Zod validation schemas
├── docs/                        # Architecture, Decision logs, and ER diagrams
├── infra/                       # Docker Compose, Kind configs, K8s RBAC
└── templates/                   # Golden path templates (Express, React, FastAPI)
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

---

## 4. Design Decisions & Tradeoffs

### 1. Why GitHub Actions builds images instead of the API
The IDP API must never mount `/var/run/docker.sock` or invoke `docker build` directly on the host server. Mounting the Docker socket compromises host security by effectively granting root access. Delegating image builds to GitHub Actions offloads compute-heavy compiler/container tasks to ephemeral CI runners, preserves sandbox isolation, and produces signed container images in GHCR with auditable commit SHAs.

### 2. Direct Apply vs GitOps (and ArgoCD integration)
In this implementation, the IDP directly applies Kubernetes manifests (`Deployment`, `Service`, `ConfigMap`, `Secret`) using `@kubernetes/client-node` with a scoped `ServiceAccount`. 
- **Advantage**: Immediate feedback loops, real-time rollout telemetry, instantaneous automated rollbacks, and simpler developer onboarding.
- **GitOps Evolution**: To adopt GitOps, the IDP manifest builder can commit generated manifests into an environment repository (e.g. `systemwithayush/idp-gitops-manifests`), where ArgoCD or Flux watches the repository and reconciles the desired state.

### 3. Advisory AI with Mandatory Human Approval
AI-generated infrastructure recommendations (right-sizing CPU/Memory and replica recommendations) are advisory. LLMs cannot replace operational context. All generated recommendations undergo strict JSON schema validation, quota boundary validation, and must be reviewed and approved by an authorized Team Lead or Admin before mutating environment configurations.


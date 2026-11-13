<div align="center">

# 🚀 Internal Developer Platform (IDP)

**A self-service engineering portal for teams to scaffold, deploy, and govern microservices**

[![CI Pipeline](https://github.com/systemwithayush/IDP/actions/workflows/ci.yml/badge.svg)](https://github.com/systemwithayush/IDP/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20_LTS-339933?logo=nodedotjs)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Test Coverage](https://img.shields.io/badge/Coverage-85%25-brightgreen)](apps/api)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma)](https://prisma.io)
[![OpenAPI](https://img.shields.io/badge/OpenAPI-3.0-85EA2D?logo=swagger)](http://localhost:4000/docs)

</div>

---

## 📸 Screenshots

### Login Page
> Clean login with persona quick-select (Admin / Lead / Developer)

![Login Page](https://raw.githubusercontent.com/systemwithayush/IDP/main/docs/screenshots/login.png)

### Admin Dashboard (Divya)
> Full org-wide view — all services, secrets vault, audit trail, user management

![Admin Dashboard](https://raw.githubusercontent.com/systemwithayush/IDP/main/docs/screenshots/admin-dashboard.png)

### Lead Dashboard (Deepak)
> Team-scoped view — deploy to staging/prod, approve AI advisory, team secrets

![Lead Dashboard](https://raw.githubusercontent.com/systemwithayush/IDP/main/docs/screenshots/lead-dashboard.png)

### Developer Dashboard (Ayush)
> Scaffold services, deploy to dev/staging, Terraform HCL viewer

![Developer Dashboard](https://raw.githubusercontent.com/systemwithayush/IDP/main/docs/screenshots/dev-dashboard.png)

---

## 🎯 What Is This?

The **Internal Developer Platform (IDP)** is a full-stack self-service portal that gives engineering teams everything they need to go from idea to production safely:

| Feature | Description |
|---------|-------------|
| 🏗️ **Golden Path Scaffolding** | Scaffold microservices with Dockerfile, CI/CD, Helm chart in one click |
| 🔐 **Role-Based Access Control** | Admin / Lead / Developer personas with JWT + scoped API access |
| 🔑 **Secrets Vault** | AES-256-GCM encrypted secrets per environment, audit-logged reveals |
| 🚀 **Deployment Engine** | State machine deployments → dev / staging / production via GitHub Actions |
| 📊 **AI Advisory** | OpenAI-powered right-sizing recommendations, approve/reject by leads |
| 🏗️ **Terraform HCL Generator** | Multi-file IaC output per service, downloadable |
| 📡 **Live Pod Logs** | Real-time Kubernetes log streaming via Socket.io |
| 📋 **Audit Trail** | Immutable log of every action across the platform |
| 📦 **Quota Management** | Per-team resource limits (services, CPU, memory) |
| 📬 **Notifications** | Email (Nodemailer), Slack, Discord webhook alerts |

---

## 👥 Personas & Access Control

| Persona | Email | Role | Access |
|---------|-------|------|--------|
| **Divya** | `divya@idp.internal` | `admin` | Full platform — all teams, secrets, users, audit |
| **Deepak** | `deepak@idp.internal` | `lead` | Team-scoped — staging + prod deploy, AI advisory approval |
| **Ayush** | `ayush@idp.internal` | `developer` | Dev/staging deploy, scaffold, Terraform viewer |

> **Universal password:** `password123`

```
Admin   → Fleet Overview, All Services, Terraform, AI Advisory, Secrets Vault, Full Audit, User Management
Lead    → Team Services, Deployments (staging+prod), AI Advisory, Team Secrets (audited), Team Audit
Dev     → My Services, Scaffold New, Deployments (dev+staging), Terraform HCL (read-only), My Audit
```

---

## 🏛️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Browser (React 18)                      │
│  LoginPage → AuthContext → Role Router → Persona Dashboard  │
└──────────────────────┬──────────────────────────────────────┘
                       │  REST + Socket.io
┌──────────────────────▼──────────────────────────────────────┐
│               Express API (Port 4000)                        │
│  Auth · Services · Environments · Secrets · Deployments     │
│  AI Advisory · Terraform · Scaffold · Quotas · Audit · K8s  │
└────────┬──────────────────────────┬────────────────┬────────┘
         │                          │                │
    ┌────▼────┐              ┌──────▼─────┐   ┌─────▼──────┐
    │  MySQL  │              │ GitHub API │   │ Kubernetes  │
    │ Prisma  │              │  Actions   │   │  (kubectl)  │
    └─────────┘              └────────────┘   └────────────┘
```

---

## 🗂️ Monorepo Structure

```
IDP/
├── apps/
│   ├── api/                    # Express + TypeScript backend
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/       # JWT, bcrypt, refresh tokens
│   │   │   │   ├── services/   # Service catalogue CRUD
│   │   │   │   ├── environments/ # Env + AES-256-GCM secrets
│   │   │   │   ├── deployments/ # State machine + GitHub Actions
│   │   │   │   ├── ai-advisory/ # OpenAI recommendations
│   │   │   │   ├── terraform/  # Multi-file HCL generator
│   │   │   │   ├── scaffold/   # Golden path templates
│   │   │   │   ├── quotas/     # Per-team resource limits
│   │   │   │   ├── audit/      # Immutable audit log
│   │   │   │   ├── k8s/        # Kubernetes manifest builder
│   │   │   │   └── notifications/ # Email, Slack, Discord
│   │   │   └── server.ts       # Express + Socket.io bootstrap
│   │   └── prisma/
│   │       ├── schema.prisma   # 13-entity schema
│   │       └── seed.ts         # Divya / Deepak / Ayush
│   └── web/                    # React 18 + Vite frontend
│       └── src/
│           ├── context/        # AuthContext (JWT + localStorage)
│           ├── components/     # DashboardLayout, ProtectedRoute
│           └── pages/          # LoginPage, Admin/Lead/DevDashboard
├── packages/
│   └── shared/                 # Shared types, constants
├── infra/
│   ├── docker-compose.yml      # MySQL + Redis
│   ├── kind-up.sh              # Local Kubernetes cluster
│   └── kind-up.bat             # Windows version
├── templates/                  # Golden path scaffold templates
├── .github/
│   └── workflows/
│       └── ci.yml              # Lint → Test → Build → Coverage
└── Makefile                    # dev, test, build shortcuts
```

---

## 🔄 Deployment Flow

```
Developer clicks Deploy
         │
         ▼
   [Validate Quota]  ──► Quota exceeded? ──► Error response
         │
         ▼
   [Create Deployment Record]  status: "pending"
         │
         ▼
   [Dispatch GitHub Actions]   workflow_dispatch trigger
         │
         ▼
   [Webhook Callback]          HMAC-verified POST /webhooks/github
         │
         ├──► status: "running"   ──► Socket.io broadcast → UI update
         │
         └──► status: "success"   ──► Notification (email + Slack)
                   or "failed"    ──► Alert + Rollback available
```

---

## 🗄️ Database Schema (ER Diagram)

```
User ──────── Team ──────── Service ──────── Environment ──────── Secret
 │             │               │                   │
 │             │               ├──── Deployment     └──── (AES-256-GCM encrypted)
 │             │               ├──── TerraformModule
 │             │               └──── AIAdvisory
 │             └──── Quota
 └──────────────────────────── AuditLog
                                    └──── (every action logged here)
```

**13 entities:** `User`, `Team`, `Service`, `Environment`, `Secret`, `Deployment`, `TerraformModule`, `AIAdvisory`, `Quota`, `AuditLog`, `Notification`, `K8sManifest`, `RefreshToken`

---

## 🚦 CI/CD Pipeline

```yaml
# .github/workflows/ci.yml
Push / PR → main
      │
      ├─ Lint (ESLint + Prettier)
      ├─ Typecheck (tsc --noEmit)
      ├─ Unit Tests (Jest · 155 tests)
      ├─ Coverage check (≥85% stmt · ≥70% branch)
      └─ Build (tsc + vite build)
```

**Coverage:** 85.2% statements · 70.52% branches · 155 tests across 15 suites

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, Vite, TypeScript, Tailwind CSS, React Router v6, TanStack Query, Socket.io-client |
| **Backend** | Node.js 20, Express, TypeScript, tsx watch |
| **Database** | MySQL 8, Prisma ORM |
| **Auth** | JWT (15-min access + httpOnly refresh), bcrypt, RBAC middleware |
| **Crypto** | AES-256-GCM for secrets at rest |
| **Deployments** | GitHub Actions `workflow_dispatch`, HMAC webhooks |
| **K8s** | `@kubernetes/client-node`, typed manifest builder, pod log streaming |
| **AI** | OpenAI API, strict JSON schema responses |
| **IaC** | Multi-file Terraform HCL generator |
| **Notifications** | Nodemailer (SMTP), Slack Webhooks, Discord Webhooks |
| **Testing** | Jest, `ts-jest`, Supertest, mock-prisma |
| **CI** | GitHub Actions, ESLint, Prettier |
| **Infra** | Docker Compose (local MySQL), kind (local K8s) |

---

## ⚡ Quick Start

### Prerequisites
- Node.js 20 LTS
- Docker Desktop
- Git

### 1. Clone & Install

```bash
git clone https://github.com/systemwithayush/IDP.git
cd IDP
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env — set DATABASE_URL, JWT_SECRET, etc.
```

### 3. Start the Database

```bash
docker compose -f infra/docker-compose.yml up -d
```

### 4. Run Migrations & Seed

```bash
npx prisma db push --schema apps/api/prisma/schema.prisma
npx tsx apps/api/prisma/seed.ts
# Creates: divya@idp.internal · deepak@idp.internal · ayush@idp.internal
# Password for all: password123
```

### 5. Start Development Servers

```bash
# Terminal 1 — API (port 4000)
npm run dev --workspace=@idp/api

# Terminal 2 — Frontend (port 5173)
npm run dev --workspace=@idp/web
```

### 6. Open the App

```
http://localhost:5173
```

Click a persona card or enter credentials manually and sign in.

---

## 🔑 API Reference

The full OpenAPI 3.0 spec is available at:

```
http://localhost:4000/docs
```

### Key Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/v1/auth/login` | — | Login, returns JWT |
| `POST` | `/api/v1/auth/refresh` | Cookie | Refresh access token |
| `GET` | `/api/v1/services` | JWT | List all services |
| `POST` | `/api/v1/services` | JWT (lead+) | Create service |
| `POST` | `/api/v1/scaffold` | JWT | Scaffold from template |
| `GET` | `/api/v1/deployments` | JWT | List deployments |
| `POST` | `/api/v1/deployments` | JWT | Trigger deployment |
| `POST` | `/api/v1/deployments/:id/rollback` | JWT (lead+) | Rollback |
| `GET` | `/api/v1/terraform/:serviceId` | JWT | Generate HCL |
| `GET` | `/api/v1/ai-advisory` | JWT | List advisories |
| `POST` | `/api/v1/ai-advisory/:id/approve` | JWT (lead+) | Approve advisory |
| `GET` | `/api/v1/environments/:id/secrets` | JWT (lead+) | List secrets |
| `GET` | `/api/v1/audit` | JWT | Audit log |
| `GET` | `/api/v1/quotas` | JWT | Quota usage |

---

## 🧪 Running Tests

```bash
# All tests with coverage
npm test

# Watch mode
npm run test:watch --workspace=@idp/api

# Type check only
npm run typecheck
```

**Results:** 155 tests · 15 suites · 85.2% coverage

---

## 🌐 Local Kubernetes (Optional)

```bash
# Start kind cluster (Linux/Mac)
bash infra/kind-up.sh

# Windows
infra\kind-up.bat
```

This creates a local `kind` cluster so live pod log streaming works end-to-end.

---

## 📁 Environment Variables

```env
# .env.example
DATABASE_URL=mysql://idp:idp@localhost:3306/idp
JWT_SECRET=change-me-to-something-random-64-chars
JWT_REFRESH_SECRET=another-random-secret-64-chars
PORT=4000
NODE_ENV=development

# Optional
OPENAI_API_KEY=sk-...
GITHUB_TOKEN=ghp_...
GITHUB_OWNER=your-org
GITHUB_REPO=your-repo
SMTP_HOST=smtp.gmail.com
SMTP_USER=you@gmail.com
SMTP_PASS=app-password
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

---

## 📌 Project Links

| Resource | URL |
|----------|-----|
| 🔗 **GitHub Repo** | https://github.com/systemwithayush/IDP |
| 📋 **API Docs (Swagger)** | http://localhost:4000/docs |
| 🌐 **Frontend** | http://localhost:5173 |
| 🏃 **CI Pipeline** | https://github.com/systemwithayush/IDP/actions |
| 📝 **Pull Request Template** | [.github/pull_request_template.md](.github/pull_request_template.md) |

---

## 👨‍💻 Team

| Name | Role | Email |
|------|------|-------|
| **Divya** | Platform Admin | divya@idp.internal |
| **Deepak** | Team Lead | deepak@idp.internal |
| **Ayush** | Developer | ayush@idp.internal |

---

## 📜 License

MIT © 2024 — Internal Developer Platform Project

---

<div align="center">
  Built with TypeScript · React · Express · Prisma · Tailwind CSS
</div>

# Steps to Open & Run the Project

This guide provides step-by-step instructions to run the Internal Developer Platform (IDP) locally.

---

## Prerequisites

1. **Node.js**: `v20.x` or `v24.x` (verified with `node -v`)
2. **NPM**: `v10.x` or `v11.x` (verified with `npm -v`)
3. **Docker & Docker Compose**: (Optional for local MySQL container; or local MySQL server on port 3306)
4. **Git**: Installed and configured

---

## Quick Start (Step-by-Step)

### Step 1: Clone the Repository
```bash
git clone https://github.com/systemwithayush/IDP.git
cd IDP
```

### Step 2: Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
# On Linux/macOS
cp .env.example .env

# On Windows PowerShell
Copy-Item .env.example .env
```

Review the values in `.env`:
- `DATABASE_URL`: `mysql://idp_user:idp_password@localhost:3306/idp_db`
- `JWT_ACCESS_SECRET`: Secret key (min 32 chars)
- `JWT_REFRESH_SECRET`: Secret key (min 32 chars)
- `ENCRYPTION_KEY`: 32-byte base64 string

### Step 3: Start the MySQL Database
If using Docker:
```bash
docker compose -f infra/docker-compose.yml up -d
```
Or use the Makefile shortcut:
```bash
make db-up
```

### Step 4: Install Dependencies
Run from the repository root:
```bash
npm install
```

### Step 5: Initialize the Database & Seed Data
Generate the Prisma client, apply schema migrations, and seed initial teams, users, quotas, and golden path templates:
```bash
# Generate Prisma Client
npm run db:generate

# Run Migrations
npm run db:migrate

# Seed Database
npm run db:seed
```

### Step 6: Run Tests
Run the test suite across all packages:
```bash
npm test
```

### Step 7: Start Development Servers
Start both the Express API (port `4000`) and the Vite React Frontend (port `5173`):
```bash
npm run dev
```
Or via Makefile:
```bash
make dev
```

---

## Default Seed Credentials

Use these seeded accounts to log into the platform:

| Role | Email | Password | Team |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin1@idp.internal` | `Password123!` | Platform Engineering |
| **Team Lead** | `lead.platform@idp.internal` | `Password123!` | Platform Engineering |
| **Team Lead** | `lead.payments@idp.internal` | `Password123!` | Payments & Checkout |
| **Developer** | `dev.alice@idp.internal` | `Password123!` | Platform Engineering |
| **Developer** | `dev.bob@idp.internal` | `Password123!` | Payments & Checkout |

---

## Verifying the Services

- **Web Portal UI**: [http://localhost:5173](http://localhost:5173)
- **API Health Check**: [http://localhost:4000/health](http://localhost:4000/health)
- **API Readiness**: [http://localhost:4000/ready](http://localhost:4000/ready)
- **API Info**: [http://localhost:4000/api/v1](http://localhost:4000/api/v1)


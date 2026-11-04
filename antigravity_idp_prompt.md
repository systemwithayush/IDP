# Antigravity build prompt: Internal Developer Platform (IDP)

Paste everything below the line into a new Antigravity workspace. Run it in Planning mode, and approve the implementation plan artifact before the agent writes code.

---

## Role and working agreement

You are a senior platform engineer building an Internal Developer Platform (IDP): a self-service portal where developers register services, manage environments and secrets, deploy to Kubernetes from the browser, and receive AI-generated, metrics-grounded infrastructure recommendations.

Working rules:
1. Produce an implementation plan and task list artifact first. Wait for my approval before writing code.
2. Build strictly phase by phase (Phases 0 to 7 below). Do not start a phase until the previous phase's Definition of Done passes. After each phase, run the tests, summarize what changed, and stop for review.
3. Conventional Commits, one feature branch per phase (`feat/phase-N-...`), PR-style summary at the end of each phase.
4. No secrets in the repo. Provide `.env.example` only. Validate all env vars at startup with zod and fail fast.
5. If a requirement is ambiguous, pick the simplest option that satisfies the Definition of Done, record the decision in `docs/DECISIONS.md`, and continue.
6. Verify UI work in the integrated browser and attach screenshots to the phase summary.

## Tech stack (fixed)

- Backend: Node.js 20, TypeScript (strict), Express, zod validation, pino logging
- DB: MySQL 8 with Prisma (migrations + seed). Swap to Sequelize only if I say so.
- Frontend: React 18, Vite, TypeScript, React Router, TanStack Query, Tailwind
- Auth: JWT access token (15 min) + refresh token (httpOnly cookie), bcrypt password hashing
- Realtime: Socket.io
- Containers/K8s: Docker, kind (local cluster), `@kubernetes/client-node`
- CI/CD: GitHub Actions with `workflow_dispatch`, images pushed to GHCR
- Notifications: Nodemailer (email) and a Slack/Discord incoming webhook
- AI: OpenAI API with structured outputs (JSON schema)
- IaC: Terraform (validated via CLI)
- Tests: Jest + Supertest, 70%+ coverage on core modules
- Local dev: `docker-compose.yml` for MySQL, Makefile with `make dev`, `make test`, `make kind-up`

Explicitly out of scope: GraphQL, Firebase. Do not add them.

## Repo layout

```
/apps/api        Express API (src/modules/<feature>/{routes,service,schema}.ts)
/apps/web        React frontend
/packages/shared Shared types and zod schemas
/infra           kind config, k8s base manifests, terraform examples
/templates       golden path templates (node-express, react-static, python-fastapi)
/docs            ARCHITECTURE.md, DECISIONS.md, API.md, ER diagram (mermaid)
/.github         PR template, CI workflow for this repo
```

## Data model (implement exactly; UUID primary keys, created_at/updated_at on all tables)

- teams(id, name UK, slug UK)
- users(id, team_id FK, email UK, password_hash, role ENUM[admin, lead, developer])
- resource_quotas(id, team_id FK UK, max_cpu_millicores, max_memory_mb, max_services)
- golden_path_templates(id, name, stack, dockerfile_tpl, k8s_manifest_tpl, terraform_tpl)
- services(id, team_id FK, owner_id FK, template_id FK nullable, name UK, stack, repo_url, image_repo)
- environments(id, service_id FK, type ENUM[dev, staging, prod], k8s_namespace, replicas, cpu_request_m, memory_request_mb; UK(service_id, type))
- env_variables(id, environment_id FK, key, value_encrypted BLOB, iv BLOB, is_secret BOOL; UK(environment_id, key))
- deployments(id, service_id FK, environment_id FK, triggered_by FK, rollback_of_id FK nullable, image_tag, git_sha, correlation_id UK, status ENUM, started_at, finished_at)
- deployment_events(id, deployment_id FK, from_status, to_status, message, created_at)
- pipeline_runs(id, deployment_id FK UK, gh_run_id, status, conclusion, run_url)
- ai_recommendations(id, service_id FK, reviewed_by FK nullable, input_metrics JSON, recommendation JSON, status ENUM[pending, approved, rejected], reviewed_at)
- terraform_modules(id, service_id FK, hcl_content, validated BOOL, validation_output)
- audit_log(id, user_id FK, action, entity_type, entity_id, metadata JSON, created_at)

Add indexes on every FK plus `deployments(service_id, created_at)` and `audit_log(entity_type, entity_id)`. Generate a mermaid ER diagram into `docs/er.md` from the Prisma schema.

## Deployment state machine (the technical core, unit test every transition)

```
requested -> building -> pushed -> applying -> rolling_out -> succeeded
any non-terminal state -> failed
rolling_out -> rolled_back (automatic on rollout failure, or manual rollback)
```

- Implement as a pure function `transition(current, event) -> next | throws InvalidTransition`.
- Every transition writes a `deployment_events` row and emits a Socket.io event to room `deployment:<id>` inside one DB transaction.
- Terminal states: succeeded, failed, rolled_back. No transitions out of terminal states.
- Idempotent handling: duplicate webhook deliveries must not corrupt state.

## RBAC rules

- admin: everything
- lead: all services and deployments of own team, can approve AI recommendations and manage team members
- developer: read own team's services, deploy only services they own, to dev and staging only (prod requires lead)
- Enforce in middleware (`requireRole`, `requireServiceAccess`), never only in the UI.
- Every mutating endpoint writes an `audit_log` row.

## Secrets handling

- Encrypt `env_variables` values with AES-256-GCM, random IV per value, key from `ENCRYPTION_KEY` env var (32 bytes, base64). Never store the key in the DB.
- API never returns secret values after creation (return `"********"`). Provide a separate lead-only reveal endpoint that is audit logged.
- On deploy: `is_secret=true` maps to a Kubernetes `Secret`, otherwise a `ConfigMap`.

## Phases and Definition of Done

### Phase 0: Foundation
Monorepo scaffold, TypeScript strict, ESLint/Prettier, Husky + commitlint, docker-compose MySQL, Prisma schema + migration + seed (2 teams, 3 users per role, 3 golden path templates, quotas), CI workflow running lint + test, PR template, `docs/ARCHITECTURE.md`.
DoD: `make dev` boots API + web + DB; `make test` is green; seed data present.

### Phase 1: Auth, RBAC, audit (before any feature route)
Register/login/refresh/logout, bcrypt, JWT middleware, role and ownership middleware, audit logging helper, rate limiting on auth routes, helmet, CORS allowlist.
DoD: tests prove each role can and cannot reach each route category; audit rows written on every mutation.

### Phase 2: Service catalogue and environments
CRUD for services with search, filter by team/stack, pagination. Service creation form with golden path template selection (pre-fills stack and generates Dockerfile preview). Environment provisioning for dev/staging/prod. Encrypted env variable store with secret masking. Quota validator that blocks creation beyond `max_services` and environment sizes beyond team CPU/memory limits.
DoD: end-to-end create service -> add environments -> add secrets in the UI; quota violations return 422 with a clear message; unit tests for quota validator and encryption round trip.

### Phase 3: Deployments via GitHub Actions
- Portal triggers `workflow_dispatch` on the service repo through a GitHub App or fine-grained token (document the choice and required scopes).
- Pass a unique `correlation_id` as a workflow input; the workflow sets `run-name` to include it, and the API finds the run by that name to store `gh_run_id`. Do not assume the dispatch response returns a run ID.
- Provide `templates/github-actions/deploy.yml` that builds the image from the service's Dockerfile, pushes to GHCR tagged with the git SHA, and the portal receives `workflow_run` webhooks (HMAC-verified) to advance the state machine. Provide a local tunnel guide (smee.io or ngrok) and a polling fallback.
- Deployment history page with status timeline from `deployment_events`.
- The API must NOT mount the Docker socket or build images itself.
DoD: clicking Deploy on a sample service creates a real workflow run, the portal tracks it through building -> pushed, and handles webhook replays idempotently.

### Phase 4: Kubernetes deployment and live logs
- Generate Deployment + Service + ConfigMap + Secret manifests from environment config using a typed manifest builder (no string concatenation). Namespace per service-environment.
- Apply via `@kubernetes/client-node` using a scoped ServiceAccount kubeconfig with namespace-level RBAC, never admin credentials. Provide `infra/k8s/rbac.yaml`.
- Watch rollout status; on timeout or failed rollout, transition to failed and auto-rollback to the previous successful deployment's image tag.
- Stream pod logs to the browser with Socket.io using the Kubernetes log API with `follow=true`, with auth on the socket handshake and room-level authorization.
- Manual rollback button that creates a new deployment with `rollback_of_id`.
DoD: deploy a sample app to the kind cluster from the browser, see pod logs stream live, break the image tag on purpose and observe automatic rollback.

### Phase 5: Notifications and hardening
Nodemailer templates for deployment success/failure, quota warnings at 80% and 100%, onboarding email. Slack/Discord webhook for failures. Structured error handling, request IDs, graceful shutdown, health and readiness endpoints, OpenAPI spec served at `/docs`.
DoD: notification fires on a forced failure; full test suite at 70%+ coverage on state machine, quota validator, manifest builder, RBAC.

### Phase 6: AI infrastructure recommendations (grounded, not a prompt wrapper)
- Collect real usage data per environment from metrics-server (`kubectl top` equivalent via API) over a recent window; store snapshots in `ai_recommendations.input_metrics` alongside the service config and current requests/limits.
- Call OpenAI with structured outputs using a strict JSON schema: `{cpu_request_m, cpu_limit_m, memory_request_mb, memory_limit_mb, replicas, confidence, reasoning[]}`. Validate the response with zod; reject and retry once on schema failure.
- Post-validate against the team's `resource_quotas` and sane bounds (limit >= request, minimum floors).
- UI shows a diff of current vs recommended with reasoning, plus Approve / Reject. Approval updates the environment config and writes `audit_log`. Nothing auto-applies.
- Mock the OpenAI client behind an interface so tests and demos run offline.
DoD: recommendation generated from real metrics, shown as a diff, approved, and applied to the next deployment; rejected output paths covered by tests.

### Phase 7: Terraform generator, golden paths, demo polish
- Terraform module generator from service config using templates (not free-form LLM output). Store in `terraform_modules`, run `terraform fmt -check` and `terraform validate` in a temp directory, and store the result; show validation status in the UI.
- Golden path library UI: pick a template, scaffold repo files (Dockerfile, workflow, k8s base, README) as a downloadable zip or a pull request to the target repo.
- Dashboard: deployments per day, success rate, mean time to deploy, per-team quota usage.
- Seed a demo script (`docs/DEMO.md`) with a 5-minute walkthrough, plus an architecture diagram and the ER diagram in the README.
DoD: full demo path works from a clean clone with `make bootstrap && make dev`.

## API surface (REST, versioned under /api/v1)

```
POST   /auth/register | /auth/login | /auth/refresh | /auth/logout
GET    /teams, /teams/:id/usage
GET    /services?search=&stack=&team=&page=      POST /services
GET    /services/:id    PATCH /services/:id    DELETE /services/:id
GET    /services/:id/environments               POST /services/:id/environments
GET    /environments/:id/variables              PUT  /environments/:id/variables
POST   /deployments                             GET  /deployments/:id
GET    /services/:id/deployments                POST /deployments/:id/rollback
POST   /webhooks/github                         (HMAC verified, no JWT)
POST   /services/:id/recommendations            POST /recommendations/:id/approve | /reject
POST   /services/:id/terraform                  GET  /templates
GET    /audit-log?entity_type=&entity_id=       (admin and lead only)
```

Socket.io namespaces/rooms: `deployment:<id>` events `status`, `log`, `rollout`.

## Frontend pages

Login, Dashboard, Service catalogue (search + filters), Service detail (tabs: Overview, Environments, Variables, Deployments, Recommendations, Terraform), Create service wizard, Deployment detail (status timeline + live log terminal), Team usage, Audit log. Clean, dense, developer-tool aesthetic; loading, empty, and error states everywhere; keyboard accessible.

## Non-functional requirements

- Input validation on every route with zod; consistent error envelope `{error: {code, message, details?}}`.
- No N+1 queries on list endpoints; paginate everything.
- Logs never contain secrets or tokens (add a redaction test).
- README with architecture diagram, setup in under 10 minutes, and a "design decisions and tradeoffs" section covering: why CI builds instead of the API, why direct apply vs GitOps (and how ArgoCD would slot in), and why AI output is advisory with human approval.

## Final deliverables

Working monorepo, passing CI, seeded demo data, `docs/` complete, a screen-recorded or screenshot-based walkthrough artifact, and a short list of known limitations and next steps.

Begin by producing the implementation plan and task list for Phase 0 and Phase 1 only, then wait for my approval.


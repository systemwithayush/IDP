# Architecture Decision Records (ADRs)

## ADR-001: Monorepo Tooling via NPM Workspaces
- **Date**: 2026-11-04
- **Status**: Accepted
- **Context**: The project requires managing multiple packages (`packages/shared`, `apps/api`, `apps/web`) with TypeScript compilation and shared dependencies.
- **Decision**: Use standard npm workspaces supported natively in Node.js 20+.
- **Consequences**: No third-party monorepo orchestrator bloat; clean sibling dependency resolution using `"@idp/shared": "*"`.

## ADR-002: MySQL 8 with Prisma ORM
- **Date**: 2026-11-04
- **Status**: Accepted
- **Context**: Need strict relational integrity, UUID primary keys, and deterministic migration execution.
- **Decision**: Adopt MySQL 8 via Prisma ORM as fixed in the specification.
- **Consequences**: Type-safe queries, migration automation, and declarative relational schema across 13 core entities.

## ADR-003: Pure Function Deployment State Machine
- **Date**: 2026-11-04
- **Status**: Accepted
- **Context**: Deployment transitions must be strictly enforced, unit-testable without DB mocks, and resilient to webhook replays.
- **Decision**: Implement the transition engine as a pure deterministic function `transition(currentStatus, event) -> nextStatus | throws InvalidTransitionError`.
- **Consequences**: Every transition writes an event to `deployment_events` inside a database transaction and emits real-time updates over Socket.io.

## ADR-004: Typed Kubernetes Manifest Builder
- **Date**: 2026-11-05
- **Status**: Accepted
- **Context**: Generating Kubernetes YAML or JSON via raw template string concatenation is vulnerable to syntax corruption, injection vulnerabilities, and type errors.
- **Decision**: Build all Kubernetes objects (`Namespace`, `ConfigMap`, `Secret`, `Deployment`, `Service`) using typed TypeScript builder classes conforming to `@kubernetes/client-node` object schemas.
- **Consequences**: Eliminates string interpolation errors, guarantees valid Kubernetes API objects, and supports seamless programmatic dry-run validation.

## ADR-005: AES-256-GCM Zero-Secret Vault
- **Date**: 2026-11-05
- **Status**: Accepted
- **Context**: Application secrets (API keys, database credentials) must never be stored in plaintext in the database or committed to git.
- **Decision**: Use authenticated AES-256-GCM with unique 12-byte initialization vectors (IVs) and 16-byte authentication tags. Mask secrets (`••••••••••••`) in all standard API responses; restrict reveal to Lead/Admin roles with mandatory audit logging.
- **Consequences**: Cryptographic confidentiality and tamper detection; immutable audit trail on every secret reveal action.

## ADR-006: Grounded AI Infrastructure Advisory Engine
- **Date**: 2026-11-06
- **Status**: Accepted
- **Context**: Automated resource optimization must not hallucinate invalid Kubernetes values, must never exceed team quotas, and must provide transparent mathematical reasoning.
- **Decision**: Ground AI recommendations on 7-day P95 utilization metrics, enforce OpenAI JSON Schema structured output with automatic schema retry, and post-validate recommendations against team resource quotas before presenting to human reviewers.
- **Consequences**: Safe, explainable resource rightsizing that leads to verifiable cost reductions without compromising reliability.

## ADR-007: Terraform Multi-File HCL Generation
- **Date**: 2026-11-09
- **Status**: Accepted
- **Context**: Workloads require cloud infrastructure beyond Kubernetes (managed Cloud SQL databases, object storage buckets, IAM).
- **Decision**: Provide an automated multi-file Terraform HCL generator (`versions.tf`, `variables.tf`, `main.tf`, `database.tf`, `storage.tf`, `outputs.tf`) supporting both GCP and AWS with syntax validation and 1-click download.
- **Consequences**: Developers can transition services from local Kind clusters to production public cloud infrastructure without writing boilerplate HCL.

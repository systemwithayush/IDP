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


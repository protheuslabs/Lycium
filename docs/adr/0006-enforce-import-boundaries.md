# ADR 0006: Enforce Import Boundaries

## Status

Accepted

## Context

Lycium is moving toward a long-lived architecture with a Next.js learner app, shared contracts, data-access adapters, backend services, and eventually cloud and Infring-backed runtimes. Without explicit dependency direction, feature work can quietly couple contracts to apps, web UI to backend internals, or adapters to one runtime.

## Decision

Use an automated import-boundary guard in `scripts/check-import-boundaries.mjs`.

The dependency direction is:

1. `packages/contracts` is the lowest-level shared contract layer and must not import app, service, data-access, or UI implementation code.
2. `packages/data-access` may depend on contracts, but must not depend on apps or backend services.
3. `apps/lycium-web` may depend on contracts, data-access, and UI packages, but must not import backend service internals directly.

## Consequences

Runtime integration should happen through contracts and adapters instead of cross-layer imports. If a new dependency direction becomes necessary, it should be captured as an ADR and added deliberately to the guard.

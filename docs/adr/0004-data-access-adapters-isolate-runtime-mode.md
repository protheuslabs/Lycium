# ADR 0004: Data Access Adapters Isolate Runtime Mode

## Status

Accepted

## Context

Lycium needs local, static JSON, cloud, and future Infring-backed runtime modes without forking the learner UI.

## Decision

Use `@lycium/data-access` repository adapters for course catalogs, course snapshots, progress, generation, settings, and browser persistence. Runtime mode is configuration, not component branching.

## Consequences

The learner UI should depend on repository contracts. New storage or API modes should be implemented as adapters before they are used in components.

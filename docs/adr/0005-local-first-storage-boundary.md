# ADR 0005: Local-First Storage Boundary

## Status

Accepted

## Context

Lycium stores local progress, bookmarks, API keys, generated courses, and source metadata while also preparing for hosted/cloud synchronization.

## Decision

Keep machine-specific state out of source control under ignored local data roots such as `.lycium-local/` and `.data/`. Browser-local state should go through `@lycium/data-access`, and API-backed local state should go through `services/lycium-api`.

## Consequences

Secrets and learner state remain user-owned. Future sync can be added through adapters without changing course rendering components.

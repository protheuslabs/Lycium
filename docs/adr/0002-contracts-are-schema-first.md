# ADR 0002: Contracts Are Schema-First

## Status

Accepted

## Context

Course JSON, source records, progress, quiz attempts, generation jobs, and provider settings are shared across frontend, backend, course-generation agents, and future cloud runtimes.

## Decision

Use `packages/contracts` as the canonical contract package and keep durable runtime artifacts represented by JSON Schema. TypeScript and Python validation must align with these schemas.

## Consequences

Generated course snapshots can be validated before catalog admission. Future breaking changes require schema versioning, fixtures, and migration notes.

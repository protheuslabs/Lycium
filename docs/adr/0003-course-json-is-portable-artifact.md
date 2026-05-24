# ADR 0003: Course JSON Is the Portable Artifact

## Status

Accepted

## Context

Lycium courses must be inspectable, shareable, cacheable, and usable by local and hosted runtimes.

## Decision

Treat validated course JSON snapshots as the portable course artifact. Source records, concept cards, module summaries, assessment structure, and metadata travel with or alongside the course snapshot.

## Consequences

Local, hosted, and Infring-backed Lycium should render the same course artifact. Catalogs should reference valid snapshots rather than hidden application state.

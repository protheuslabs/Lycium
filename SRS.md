# Lycium Software Requirements Specification

This file is the entry point for the Lycium SRS. The full specification is split into smaller documents so authored files stay under the repository 500-line limit.

## Specification sections

- [Product, vision, source concept, baseline, users, and scope](./docs/srs/product-scope.md)
- [Functional requirements](./docs/srs/functional-requirements.md)
- [Non-functional requirements, data/schema requirements, and architecture requirements](./docs/srs/non-functional-schema-architecture.md)
- [Release phasing, acceptance criteria, risks, open questions, and references](./docs/srs/phasing-risks-references.md)

## Current product boundary

Lycium is a local-first learning platform that renders portable course/program JSON, records learner state separately from source evidence, and now implements the first local curriculum-compiler loop: sources are imported or packetized, preflighted, converted into benchmark/requirement evidence, used to create either a `needs_sources` draft or a generated snapshot, and then evaluated through validation, quality, citation, quiz, and review/publish gates before catalog trust.

Source Index is the reusable evidence boundary for canonical sources, snapshots, source-corpus decisions, source packets, packet quality, and crawl contracts. Lycium consumes that evidence to generate and review learning artifacts, but should not become the canonical internet index.

## Maintenance rule

When updating requirements, edit the section file that owns the relevant topic and keep this index short.

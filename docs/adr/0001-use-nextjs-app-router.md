# ADR 0001: Use Next.js App Router for Lycium Web

## Status

Accepted

## Context

Lycium needs to run as a local-first browser app, a hosted web app, and eventually an Infring-backed learning surface. The learner experience also needs stable URLs for catalogs, courses, and course units.

## Decision

Use Next.js App Router as the web application shell. Keep course traversal, quiz behavior, progress logic, and data access in shared packages instead of binding them directly to Next server components.

## Consequences

Next owns routing, layout, build, and deployment concerns. Product logic remains portable enough to run against local, static JSON, cloud, or Infring adapters.

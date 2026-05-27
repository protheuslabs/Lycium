# ADR 0007: Centralize Design Tokens

## Status

Accepted

## Context

Lycium has accumulated reusable interface pieces such as buttons, dropdowns, modals, cards, progress meters, sidebars, and course catalog controls. The product needs consistent light/dark behavior and fewer one-off color, radius, spacing, and shadow definitions.

## Decision

Keep semantic design tokens in a global CSS token layer at `apps/lycium-web/src/styles/tokens.css`. Component CSS should consume semantic variables before introducing new hardcoded color or shape values.

Tokens should describe product meaning rather than implementation trivia. Examples include `--lycium-color-surface`, `--lycium-color-border`, `--lycium-radius-pill`, and `--lycium-shadow-raised`.

## Consequences

Theme work becomes less fragile because light, dark, and auto modes resolve through the same token contract. New components should start from the shared tokens, and existing CSS can migrate incrementally without blocking feature work.

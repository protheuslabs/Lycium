# Professional readiness tracks

Lycium tracks professionalization as concrete repo evidence rather than a loose roadmap. The readiness check is intentionally small: it verifies that each professional track has at least one durable implementation, test, document, schema, or CI hook.

Run it with:

```bash
corepack pnpm check:readiness
```

## Current tracked evidence

| Track | Evidence |
| --- | --- |
| Review/publish UI | Course review panel and API review routes gate generated snapshots before catalog trust. |
| First-class benchmark persistence | Curriculum benchmark schema, artifact persistence, and benchmark/API settings tests. |
| Benchmark extraction pipeline | Benchmark extraction and benchmark compilation modules. |
| Course generation eval suite | Course generation scenario fixtures and scenario tests, including noisy-source and under-sourced prompt checks. |
| Flagship generation target | CHEM 105 benchmark/source blueprint and scenario tests for a real college-style course target. |
| Provider connection test matrix | Provider catalog and provider connection tests for cloud/local cases. |
| Generation observability | Generation run records, payload helpers, and observability tests. |
| Contract docs generated from schemas | Schema docs generator, generated schema reference, and CI docs check. |
| Local data migration/versioning | Local-store core migration support and migration tests. |
| Local secret handling | Local secret handling implementation, security docs, and tests. |
| CI deployment verification | Static GitHub Pages export verifier wired into CI and deploy workflows. |

## How to use this

- Treat this as a durability ratchet, not a claim that each track is complete.
- Add new evidence when a track becomes more mature.
- Do not remove evidence without replacing it with an equal or stronger artifact.
- Keep the check focused on existence and wiring; deeper correctness belongs in targeted tests.

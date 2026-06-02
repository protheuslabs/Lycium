# Lycium local-first execution todo

This list tracks the work needed to make Lycium's local generation, storage, and learner experience reliable before connecting exterior services or detaching Source Index.

## Active priority

1. Generation run records
   - Status: done
   - Goal: every generation attempt has durable local evidence.
   - Deliverables: DB run record, local run mirror, run detail API, run history API, resume API.

2. Source-gap resume flow
   - Status: done
   - Goal: `needs_sources` drafts can accept new sources and resume generation without starting over.
   - Depends on: generation run records.

3. Source-gap review UI
   - Status: done
   - Goal: users can see missing concepts, suggested source types, current coverage, and resume actions.
   - Depends on: source-gap resume flow.

4. Source packet contract
   - Status: done
   - Goal: stabilize `source-packet-v1` as the portable input to generation.
   - Depends on: source index packet export/import.

5. Source packet export/import
   - Status: done
   - Goal: Source Index can export, import, and validate packets without Lycium UI assumptions.

6. Benchmark extraction upgrade
   - Status: done
   - Goal: extract outcomes, topics, prerequisites, assessment types, schedule clues, and required/optional candidates.

7. Requirement origin scoring
   - Status: done
   - Goal: score requirements by benchmark frequency, source confidence, source type, and review status.

8. Course generation from requirements
   - Status: pending
   - Goal: modules and sections are built from extracted requirements instead of prompt/topic tokens alone.

9. Concept-to-source coverage map
   - Status: pending
   - Goal: every required concept has primary/fallback sources, confidence, section mapping, and weak/missing status.

10. Section citation enforcement
    - Status: partially done
    - Goal: review/generation fails when section citations are not mapped to concepts in that section.

11. Needs-sources draft behavior
    - Status: partially done
    - Goal: weak source coverage creates an incomplete draft card, not hollow lesson content.

12. Review/publish gate hardening
    - Status: partially done
    - Goal: generated courses stay draft/reviewable until source, quality, quiz, citation, and filler checks pass.

13. Generation observability UI
    - Status: partially done
    - Goal: local timeline with source decisions, gate results, quality report, errors, and resume action.
    - Depends on: generation run records.

14. Local storage export/import UI
    - Status: pending
    - Goal: expose storage health, backup, export, and latest backup from the app.
    - Depends on: local storage status/export/backup API.

15. Local data migration tests
    - Status: partially done
    - Goal: old local data fixtures migrate or fail clearly.

16. Corrupt local data handling
    - Status: pending
    - Goal: invalid JSON produces visible repair/backup warnings instead of silent fallback.

17. Provider/local model diagnostics
    - Status: partially done
    - Goal: show active provider/model, verification state, last check, discovered models, and local endpoint status.

18. Software Engineering flagship path
    - Status: pending
    - Goal: one excellent vertical path from program to capstone evidence.

19. Program progress rollup
    - Status: partially done
    - Goal: course completion satisfies requirements, requirements satisfy clusters, clusters satisfy programs.

20. Requirement detail UI
    - Status: partially done
    - Goal: requirement status, linked courses, source coverage, prerequisites, and assessment/project evidence are visible.

21. Portfolio/capstone artifact records
    - Status: pending
    - Goal: programs can require repos, essays, demos, lab reports, presentations, and case studies.

22. Course-generation eval scenarios
    - Status: partially done
    - Goal: fixed scenarios for CHEM 105, Intro Programming, Software Engineering Program, noisy corpus, and under-sourced prompts.

23. Eval score dashboard
    - Status: pending
    - Goal: track quality pass/fail, source coverage, quiz quality, content depth, and citation validity over time.

24. Noisy source filtering
    - Status: partially done
    - Goal: irrelevant sources are rejected before generation, with recorded reasons.

25. Source Index packet quality report
    - Status: pending
    - Goal: packet reports coverage, duplicates, broken URLs, source type mix, trust/freshness, and benchmark usefulness.

26. Source Index independence pass
    - Status: partially done
    - Goal: stable API, packet schema, import/export CLI, docs, and no Lycium UI assumptions.

27. Docs update
    - Status: pending
    - Goal: README/SRS describe the actual local-first compiler loop.

28. End-to-end local workflow test
    - Status: pending
    - Goal: prove sources -> draft -> source gate -> add source -> resume -> publish -> persisted progress.

29. Exterior service connection
    - Status: deferred
    - Goal: connect cloud course JSON, external Source Index, InfRing research tools, and hosted generation after local reliability.

## Current execution note

The immediate focus is making generation traceability durable and local-first. Without that, source-gap resume, review UI, eval dashboards, and debugging generated courses all become fragile.

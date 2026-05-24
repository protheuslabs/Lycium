# Lycium MVP Vertical Slice

This document narrows the next product phase to the smallest complete loop that can prove Lycium is more than a course prompt wrapper.

## Product Boundary

Lycium's MVP should do one thing exceptionally well:

> Given a topic and explicit source material, generate a validated, source-backed course snapshot that can be reviewed, saved, resumed, and learned from.

Everything outside that loop is secondary until the loop is dependable.

## Target Loop

1. A user enters a course topic, short description, difficulty level, and source links or files.
2. Lycium creates central source records for those inputs.
3. The generation system turns those source records into course JSON.
4. The course JSON includes modules, Learn pages, Apply pages, concept cards, quizzes, module summaries, source references, and catalog metadata.
5. Validation produces a machine-readable quality report and rejects malformed or unsourced course JSON before publication.
6. The user can review, edit, and lock generated sections.
7. The accepted course is explicitly published and then appears in the catalog as a course snapshot.
8. Learner progress, viewed state, bookmarks, quiz attempts, and settings persist outside source control.

## Non-Goals For This Slice

- Do not build public SEO course pages yet.
- Do not implement full credentialing, programs, portfolios, RBAC, or multi-tenancy yet.
- Do not introduce OpenSearch, a graph database, or durable workflow orchestration yet.
- Do not chase broad platform completeness before course generation quality is reliable.

## Definition Of Done

- Course generation accepts topic, level, and source inputs from the catalog modal.
- Every accepted generated course has `shortDescription`, `difficultyLevel`, `category`, `tags`, and `learningTypes`.
- Every accepted generated course has central `sourceRecords` or references existing central source records.
- Every referenced `sourceId` resolves to a known source record.
- Every instructional page is `pageType: "learn"`.
- Every assessment page is `pageType: "apply"`.
- Quiz sections contain quiz blocks only.
- Learn pages end with `conceptCards`.
- Every module ends with a summary section containing one `{PacingLabel} concepts` concept-card block.
- Invalid generated courses produce a visible generation error and do not enter the catalog.
- Valid generated courses can be reopened at their last viewed unit.

## Current Implementation Status

- Course rendering, catalog routing, progress persistence, quiz attempts, settings, and local source records exist.
- The backend LLM agent harness has a behavioral contract and rejects invalid agent output before persistence.
- The web app now validates generated and remote catalog intake before adding courses to the catalog.
- The API now exposes quality-report, submit-review, publish, and section-lock endpoints.
- The create-course modal passes submitted source links into generation requests.
- Source upload, full review UI, and richer retrieval are still incomplete.

## Immediate Next Work

1. Persist uploaded files as source records before generation.
2. Add a review screen for generated course JSON before catalog acceptance.
3. Add a section edit workflow that respects locked sections.
4. Add deeper tests for generation rejection and publication failure paths.
5. Replace heuristic retrieval with hybrid lexical/vector retrieval only after the source-backed loop is reliable.

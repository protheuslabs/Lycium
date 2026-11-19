# Hosted Learning MVP Requirements

Updated 2026-11-13. Acceptance requires evidence from the hosted environment.

The first hosted release must let a learner find a reviewed course, study its lessons, complete assessments, and return to their saved progress from another device. The beta can start with a reviewed course catalog and creator-only generation. Programs offered as complete must meet the program quality criteria.

These requirements extend FR-34 through FR-38h, FR-132 through FR-151, and NFR-26 through NFR-30 in the [SRS](../SRS.md). They supplement the [local MVP checklist](mvp-acceptance-checklist.md). The hosted API must authenticate users and enforce ownership under FR-139 through FR-141.

## Production Persistence And Deployment

| ID | Requirement | Acceptance evidence |
| --- | --- | --- |
| HOST-01 | Hosted courses, published versions, learner progress, quiz attempts, submissions, and generation records shall use persistent PostgreSQL storage. Course JSON remains the portable content contract. | Two accounts keep independent progress on the same course. An acknowledged save survives an API restart and is available on a second device. |
| HOST-02 | Database changes shall use versioned migrations with an upgrade path from the previous deployed release. | CI tests a fresh database and an upgrade with existing courses, attempts, and active jobs. Release documentation describes recovery if migration fails. |
| HOST-03 | Uploaded documents and extraction artifacts shall use private object storage through a replaceable adapter. Records shall preserve immutable artifact IDs, hashes, extraction versions, citation metadata, and retention state. | Extraction and retry work after replacing an application instance. Access tests cover cross-account requests and public citations to private uploads. |
| HOST-04 | The web app, API, and generation worker shall have repeatable production builds, environment configuration, health checks, and a documented release and rollback process. Hosted learners shall use the app in a browser with no local services required. | A clean deployment serves catalog and deep course links over HTTPS. An application rollback preserves learner data and published course versions. |
| HOST-05 | Backups shall cover the database and referenced artifacts, with tested restore procedures and documented recovery targets. | Restore into an isolated environment and reopen a published course, private upload, quiz attempt, and interrupted generation. Record recovery time and data age. |
| HOST-06 | Operations shall expose structured errors, request and job IDs, queue depth, failure rates, provider usage, and storage health. Configure allowed origins and service permissions. Keep secrets server-side and restrict hosted providers to approved adapters. | Trace a UI error to its failing stage using logs with secrets and private source text redacted. Verify that learner accounts cannot alter platform credentials or invoke local provider commands. |

Start with a managed database and object store, one API, and one independently running worker. Source Index and extraction use their existing service contracts.

## Durable Generation Jobs

| ID | Requirement | Acceptance evidence |
| --- | --- | --- |
| JOB-01 | Accepting a generation request shall durably store its original prompt, constraints, source and artifact versions, workflow versions, and selected provider and model before acknowledging it. Run jobs in a worker independent of the HTTP request and API process. | Disconnect the browser and restart the API immediately after acknowledgement. The same job remains visible and can finish. |
| JOB-02 | Workers shall claim jobs atomically with expiring leases and heartbeats. Verify ownership before accepting writes and deduplicate stage outputs and snapshots. | Run two workers against one job. Terminate the owner during a stage, reclaim the job, and confirm one accepted result with no stale overwrite. |
| JOB-03 | Each validated stage shall checkpoint its input and output references. Resume shall reuse completed compatible stages and preserve stable IDs. A changed source, plan, or model shall create an explicit new attempt and invalidate affected downstream work. Preserve authored edits. | Interrupt and resume section fill. Verify completed sections survive and regenerating one section preserves unrelated modules, edits, and learner progress. |
| JOB-04 | Retry policy shall distinguish transient timeouts and rate limits from invalid credentials, exhausted balance, invalid inputs, and content-quality failures. Bound automatic retries, apply backoff, and show the corrective action for permanent failures. | Simulate timeout, 429, 401, insufficient balance, and invalid output. Verify the retry limit, recovery message, and explicit model selection if a change is needed. |
| JOB-05 | Creation and retry requests shall be idempotent for the same account and request key. Reject reuse of a key with a changed payload. Persist cancellation, terminal failure, exhausted retries, and provider calls with uncertain completion. | Double-submit, refresh, retry, and cancel during a call. Check that one course is created and that cancelled or superseded work keeps its final state when a late result arrives. |
| JOB-06 | Queue concurrency, request size, per-account usage budgets, provider capacity, and retry budgets shall be configurable and enforced on the server. Schedule eligible work across creators fairly. | Concurrent requests from multiple accounts obey configured limits while learners continue reading saved courses. Queued and rejected requests show their status and any corrective action. |
| JOB-07 | Job completion and educational acceptance shall be separate states. Persist stage/module/section progress, last update, artifacts, quality findings, and recoverable failure even when content is rejected. | A completed but poor course remains available to its creator for review, stays out of the published catalog, and retains its original prompt for retry. |

A database-backed queue is an initial option. Persist module and section checkpoints for long jobs and record ambiguous provider usage after interrupted calls.

## Learner And Creator UI

| ID | Requirement | Acceptance evidence |
| --- | --- | --- |
| UI-01 | The public catalog shall list published courses and programs, with search, filters, descriptions, prerequisites, outcomes, workload, and stable links. Give creators authorized access to their drafts and failed generations. | A signed-out learner finds and opens a published course. Public requests for a draft fail through both the catalog and direct API access. |
| UI-02 | Start/continue learning shall lead directly to the first appropriate or last visited section. A personal learning view shall show enrolled courses, next lessons, and program requirements. | Start a course, leave mid-module, sign in on a second device, and resume at the saved section without navigating through creator/provider settings. |
| UI-03 | Lesson navigation shall show position in the course and module, previous and next actions, prerequisites, and progress. Reading completion, submitted work, and demonstrated mastery shall be distinct. | A reading updates completion. An assessment updates mastery according to its criteria. Prerequisite links lead to usable next steps and program progress counts satisfied requirements. |
| UI-04 | Quiz answers, question/answer order, attempts, timers, submissions, and feedback shall persist per learner, course version, section, and assessment. Saving/reconnecting shall be visible, and conflicting device updates shall not silently overwrite acknowledged work. | Two learners take quizzes with overlapping IDs in two courses. Reload, second-device access, and republished course versions neither mix answers nor rescore an old attempt against a new answer key. |
| UI-05 | Learning pages shall be usable at 320px mobile width, desktop sizes, and 200% zoom, with keyboard navigation, visible focus, labeled controls, readable contrast, and usable equation and code overflow. Show citations for sources used by the lesson. Apply pages omit source footers. | Complete the learning flow on mobile and by keyboard. Inspect long titles, formulas, code, error messages, missing media, and narrow menus for overlap or inaccessible controls. |
| UI-06 | Generating tiles shall remain visible across reloads with a title or `New Course`, a job state, and a main message naming the stage and current module or section when known. Keep the original request and show how to retry. Put raw provider errors in optional diagnostics. | Reopen the browser during generation. Simulate provider failure, select a replacement model, and retry using the saved prompt and upload. |
| UI-07 | Show clear states for pending saves, offline requests, expired sessions, unavailable courses, and broken media. Learners shall be able to report an issue against a specific course version and section. | Disconnect during a quiz save and confirm the persisted result after reconnecting. Report an incorrect answer and locate that report in the review workflow. |
| UI-08 | Authorized creators shall inspect failed quality dimensions, edit or regenerate scoped content, preview the learner result, and publish a new immutable version. Partial/failed content shall not disappear, and review findings shall not become lesson prose. | Repair one flagged section, revalidate affected assessments, and publish without mutating the version an existing learner used. |

## Release Evidence

- Run the full learner path against a deployed staging environment with real persistence, two accounts, and two browser contexts. Include restarts, duplicate requests, provider failure, and mobile/keyboard checks.
- Establish supported beta capacity and recovery targets using staging measurements. A proposed starting test uses 20 concurrent learners and two generation requests, with p95 saved-course navigation and job acknowledgement within 2 seconds and active-job status updates within 5 seconds. Proposed recovery targets are at most 24 hours of data loss and 4 hours to restore. Record deployment size, payload sizes, latency, and errors.
- Measure generation time by course scope, provider, model, and source size. Set separate time targets for short courses and full college courses so each can retain its intended instructional depth.
- Run a documented backup restore and application rollback before first hosted release.
- Each launch course shall satisfy [course-generation quality acceptance](course-generation-quality-acceptance.md).
- Record an evidence link, build or commit, environment, date, and owner for each accepted requirement.

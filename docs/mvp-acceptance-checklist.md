# Lycium MVP Acceptance Checklist

The local MVP lets a user turn source-backed material into editable learning paths, use those paths as a learner, and keep their data private and portable. The hosted launch adds the checks in section 11.

## 1. Local app baseline

- The web app builds successfully as a static export.
- Repository line-count, data-boundary, contract, and API tests pass.
- The app opens at `/Lycium/catalog` locally and on GitHub Pages.
- Catalog, course, program, settings, legal, and source-index routes are reachable.
- Local user data remains outside committed source files.

## 2. AI provider stability

- A user can add a cloud API key or local model endpoint.
- The selected provider and model persist across reloads.
- An unavailable provider is shown as unavailable without deleting the saved row.
- Course generation and section refresh are blocked when no verified provider is active.
- Provider failures surface clear recoverable errors.

## 3. Source-backed course generation

- A user can submit a course prompt with source URLs.
- Source preflight accepts relevant sources and rejects clearly irrelevant ones.
- Insufficient source coverage creates a draft/source-gap state instead of publishing weak content.
- The user can add sources to a draft and resume generation.
- Generated courses pass schema, source coverage, quiz, citation, and no-placeholder gates before publish.

## 4. Manual course creation and editing

- A user can create a blank manual course that opens directly in edit mode.
- Editable courses support adding, editing, deleting, and reordering modules, sections, and blocks.
- Course settings are editable in edit mode.
- Save and cancel behave predictably.
- Local draft metadata records ownership, origin, revision, and conflict information.

## 5. Fork and permission behavior

- Published/read-only courses cannot be changed in place by ordinary users.
- Editing or refreshing a protected course creates a fork.
- Forked courses preserve parent metadata.
- Users can export and import local drafts.
- The master copy remains recoverable and unmodified.

## 6. Learner experience

- A learner can browse programs, clusters, and courses.
- Course pages render lessons, quizzes, concept cards, citations, videos, and source pages.
- Completion, viewed progress, quiz attempts, bookmarks, and feedback persist locally.
- Locked prerequisites display clearly and link users toward required courses.
- Mobile catalog and course views remain usable within viewport width.

## 7. Program/pathway experience

- Programs display requirement groups/clusters.
- Clusters display course requirements and prerequisites.
- Course progress rolls up into cluster/program progress.
- Programs can include course, assessment, project, competency, and capstone requirements.
- Program generation produces valid `LyciumProgram` artifacts, not ad hoc track bundles.

## 8. Source Index foundation

- Sources can be submitted directly to Source Index outside course creation.
- Source records can be searched and reused by generation workflows.
- Source packets are stable, importable, exportable, and detached from UI assumptions.
- Submitted sources can be matched to course/program candidates.
- Source records preserve evidence, URL, title, type, and extraction status.

## 9. Quality and review gates

- Course generation has fixed eval scenarios for chemistry, programming, software engineering, pre-med, and noisy source corpora.
- Program generation has fixed eval scenarios for at least one professional pathway and one academic pathway.
- Gates provide actionable failure evidence.
- Drafts are not promoted to catalog-ready content until required gates pass.
- Quality results are recorded as reusable run artifacts.
- Live generation from ordinary subject prompts is evaluated against independent curriculum and teaching expectations. See [teaching quality acceptance](course-generation-quality-acceptance.md).

## 10. Trust, privacy, and portability

- Terms, privacy, and acceptable-use pages exist and are linked from the footer.
- The app distinguishes public source/curriculum data from private learner data.
- API keys and local endpoints are never committed.
- Users can export local learning data and drafts.
- Sensitive future cloud-sync behavior is documented before being enabled.

## 11. Hosted learner launch

Record staging evidence for the following checks in the [hosted MVP requirements](hosted-mvp-requirements.md).

- [ ] A learner can discover a published course, study it, complete an assessment, and resume from another device.
- [ ] Two learner accounts keep their courses, submissions, and progress isolated. Creator drafts and provider settings require appropriate access.
- [ ] Database migrations, backups, restores, and release rollback work with persistent data.
- [ ] Interrupted generation resumes from saved checkpoints. Duplicate requests, worker restarts, and provider failures leave a recoverable job record.
- [ ] The learning flow works on desktop and mobile, including keyboard navigation, progress saves, feedback, and content issue reporting.
- [ ] Each launch course passes teaching-quality review. Any program presented as complete has accepted required courses and assessed program outcomes.

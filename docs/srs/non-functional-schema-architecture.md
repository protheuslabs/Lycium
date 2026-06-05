## 8. Non-Functional Requirements

### 8.1 Performance

- NFR-1: Draft outline generation should complete within 30 seconds for a standard short course under normal load.
- NFR-2: Full course generation should complete within 2 minutes for a standard short course under normal load.
- NFR-3: Navigation between already-generated sections shall feel immediate and should render within 2 seconds.
- NFR-4: In-lesson conversational responses should begin streaming or otherwise become visible within 5 seconds under normal load.

### 8.2 Reliability

- NFR-5: Failed generation steps shall return actionable error states rather than silent failure.
- NFR-6: A partially generated course shall remain recoverable and editable.
- NFR-7: The system shall not lose authored edits when regeneration fails.

### 8.3 Accessibility

- NFR-8: Core learning flows shall be keyboard accessible.
- NFR-9: Generated spoken or narrated content shall have transcript support.
- NFR-10: Visual instructional content shall include text alternatives where feasible.
- NFR-11: The interface shall support responsive use on desktop and mobile.

### 8.4 Security and Privacy

- NFR-12: The system shall separate learner progress data from public course content.
- NFR-13: Sensitive learner conversation data shall be stored only as required for product functionality and analytics policy.
- NFR-14: The system shall avoid sending more learner data to model providers than the active feature requires.

### 8.5 Quality and Safety

- NFR-15: Generated educational content shall be treated as reviewable AI output, not inherently authoritative truth.
- NFR-16: The system shall support moderation and instructor review for unsafe or low-quality outputs.
- NFR-17: The system should support retrieval grounding or instructor-provided sources in later phases for higher factual reliability.

### 8.6 Knowledge Platform Integrity

- NFR-18: Search and retrieval against the knowledge base should return candidate source objects quickly enough to support interactive course generation workflows.
- NFR-19: Generated instructional content should be traceable to one or more supporting sources, or explicitly marked as synthetic connective content.
- NFR-20: Internet ingestion shall respect licensing, copyright, and robots constraints; when full reuse is not permitted, the system shall store metadata and allowable excerpts only and link back to the source.
- NFR-21: Reliability scoring and source selection logic should be explainable and auditable.
- NFR-22: The system should re-check source freshness and link health on a recurring basis.
- NFR-23: Canonicalization, deduplication, and re-ingestion workflows should be idempotent and auditable.
- NFR-24: Knowledge-object lookup and learning-packet assembly should be fast enough to support interactive course generation without forcing full recrawls.
- NFR-25: If a source disappears or becomes inaccessible, the repository should preserve enough metadata, citation history, and archive references to keep generated courses interpretable.

### 8.7 Operational and Security Requirements

- NFR-26: Authenticated API endpoints shall enforce authorization checks for protected resources.
- NFR-27: Worker execution shall be idempotent and resilient to partial failures.
- NFR-28: The platform shall provide audit logs for content changes and curation decisions.
- NFR-29: PII and learner data at rest shall be encrypted when stored outside the primary database.
- NFR-30: System secrets and API keys shall be managed via environment configuration and not hard-coded.

## 9. Data and Schema Requirements

Lycium should retain JSON as its canonical content contract. The schema shall be extended to support the new concept instead of replaced.

Minimum schema additions:

- Course metadata: prompt, target audience, duration, language, difficulty, generation status, version
- Agent roster: id, name, role, style, voice, enabled state
- Learning objectives: course-level and section-level objectives
- Scene metadata: scene type, narration text, estimated duration, mastery checkpoint
- Assessment metadata: rubric, answer type, feedback, remediation hook
- Adaptation metadata: inserted recap, skipped section, regenerated explanation, confidence marker
- Audit metadata: created by, reviewed by, last regenerated at, locked state
- Course lineage metadata: lineage id, canonical slug, owner id, maintainer ids, current published snapshot id, active draft snapshot id, edit policy, and fork policy
- Course snapshot lifecycle metadata: snapshot id, lineage id, immutable version, status, based-on snapshot id, forked-from lineage id, parent snapshot hash, published-at timestamp, archived-at timestamp, and review state
- Course edit policy metadata: owner edit permission, maintainer edit permission, learner fork permission, contributor suggestion permission, locked section ids, locked block ids, and publish gate requirements
- Course edit history metadata: draft snapshot id, editor id, operation type, target element id, previous value reference, new value reference, timestamp, and validation state
- Program metadata: path id, parent program, milestone order, capstone flag, credential checkpoint
- Knowledge object metadata: source id, canonical URL, publisher, license, modality, cost, freshness, trust score, corroboration state
- Citation graph metadata: generated block id to source object mappings and generation recipe
- Learner metadata: profile, preferences, diagnostics, saved courses, transcript, portfolio, badges, and certificates
- Source entity metadata: canonical URL, normalized domain, connector type, archive links, fetch policy, link-health status
- Snapshot entity metadata: snapshot id, source id, content hash, extraction status, fetch timestamp, last verification timestamp, artifact references
- Claim entity metadata: claim text, claim type, supporting objects, conflicting objects, confidence score
- Path graph metadata: node ids, edge types, prerequisite weights, alternative path weights, curation state
- Coverage map metadata: topic id, subtopic coverage score, modality coverage score, trust distribution, freshness distribution, known gaps

## 10. Proposed Architecture Requirements

### 10.1 System Boundary

- Lycium shall be the learner-facing application layer, including public product surfaces, learner accounts, course experience, AI classroom interaction, progress, portfolio, and credential views.
- Lycium backend services shall be the underlying knowledge-platform layer, including ingestion, extraction, cataloging, trust scoring, graph construction, retrieval, and generation orchestration.
- Lycium web and backend services should remain in the same repository during the early product phase but shall be implemented as separate deployable applications or services with clear boundaries.
- Shared schemas, contracts, and libraries shall be versioned and consumed by Lycium web and backend services through internal packages rather than ad hoc duplication.

### 10.2 Front End

- The front end shall remain a React-based client application.
- The current renderer shall be refactored so authored and generated courses use the same rendering pipeline.
- The interface shall introduce a classroom mode that can present agent dialogue, lesson scenes, and inline learner interaction.
- The course renderer shall support a read-only mode and an edit mode using the same course structure, with pencil affordances attached to editable rendered elements.
- Edit mode shall submit structured draft updates against editable draft snapshots instead of mutating published course snapshots.

### 10.3 Backend

- A backend service shall be introduced for generation, persistence, and analytics.
- The backend shall orchestrate outline generation, scene generation, assessment generation, and adaptive decision logic.
- The backend shall expose APIs for course creation, regeneration, retrieval, progress updates, and conversation turns.
- The backend shall expose course-lineage and course-snapshot APIs for creating draft revisions, saving draft edits, validating drafts, submitting drafts for review, publishing immutable snapshots, forking lineages, and proposing revisions.
- The backend shall reject direct mutation of published snapshots and shall update the current published snapshot pointer only through the publish workflow.

### 10.4 Knowledge Platform Services

- The platform shall include ingestion or indexing services for external learning resources.
- The platform shall include a connector framework for source-specific adapters and a fallback browser-based scraping service.
- The platform shall include taxonomy, metadata extraction, and content-type classification services.
- The platform shall include canonicalization, deduplication, and artifact-layer storage for raw, cleaned, and structured source data.
- The platform shall include trust scoring, provenance tracking, freshness checking, and source-policy services.
- The platform shall include search, ranking, recommendation, and prerequisite graph services over the knowledge base.
- The platform shall include coverage-map generation and repository health services.

### 10.5 AI Layer

- The AI layer shall be provider-agnostic where practical.
- The generation pipeline should separate outline generation from full content generation.
- The tutoring pipeline should use course context and learner state as explicit inputs.
- Agent personas should be configuration-driven rather than hard-coded into prompts only.
- The generation pipeline should treat the knowledge base and learner profile as first-class inputs.
- The AI layer should be able to assemble both canonical course templates and individualized course forks.
- The AI layer should reason over knowledge objects, claims, graph structure, and source policies rather than relying on page-level retrieval alone.
- The AI layer should be able to request complementary learning packets that balance trust, modality, and pedagogical fit.

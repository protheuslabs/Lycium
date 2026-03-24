# Lyceum Software Requirements Specification

## 1. Purpose

This Software Requirements Specification (SRS) defines the target product direction for Lyceum.

Lyceum currently exists as a lightweight React application that renders course content from local JSON files. This SRS extends that baseline by assimilating the concept demonstrated in the linked OpenMAIC video and by benchmarking major online course platforms. The target product is a prompt-driven, reliability-aware learning system that can catalog internet knowledge, assemble structured courses and programs, and deliver agent-led, adaptive instruction instead of only static content pages.

This document is intentionally written as an adaptation for Lyceum, not as a direct clone of OpenMAIC. The goal is to preserve Lyceum's strongest architectural trait, structured content rendered from JSON, while evolving the product into an AI-assisted learning platform.

## 2. Product Vision

Lyceum shall evolve from a static, JSON-backed course viewer into a knowledge platform and prompt-to-classroom learning system with these core behaviors:

- A learner or instructor can describe a course, learning goal, or full knowledge path in natural language.
- The system catalogs and classifies learning resources from the internet into a structured knowledge base.
- The system decomposes sources into reusable knowledge objects instead of treating URLs as the only unit of retrieval.
- The system generates a course outline, lesson scenes, quizzes, projects, and supporting assets from that knowledge base and the user's profile.
- An AI instructor guides the learner through the material.
- Optional supporting agents, such as an assistant or peer personas, create a more interactive classroom dynamic.
- The system adapts pace, explanations, and practice based on learner behavior and performance.
- Generated output remains serializable into a structured Lyceum course schema so it can be rendered, edited, versioned, and reused.
- Courses do not need to be hard-coded in the product repository; they can be generated dynamically per learner and saved as versioned course JSON in learner metadata.
- Lyceum should be able to assemble multi-course programs, including degree-equivalent knowledge paths built primarily from free or open internet resources where feasible.

## 3. Source Concept Assimilation

The concept assimilated from the linked video and source material is:

- Prompt-to-course generation should create more than slides. It should generate a complete learning path.
- The classroom should include role-based agents, not just one chatbot.
- The learner should experience guided teaching, discussion, and assessment in one interface.
- The system should show visible generation stages, such as outline generation and page-content generation.
- The classroom should feel interactive and adaptive rather than like passive video playback.

For Lyceum, this translates into four product pillars:

1. Structured AI course generation
2. Agent-led lesson delivery
3. Embedded assessment and feedback
4. Adaptive learner support with persistent course data

This SRS also incorporates benchmark signals from ten major course-oriented learning platforms:

- Coursera
- edX
- Khan Academy
- Udemy
- LinkedIn Learning
- Pluralsight
- Codecademy
- FutureLearn
- MIT OpenCourseWare
- OpenLearn

The major benchmark patterns absorbed into this SRS are:

- Stackable credentials, certificates, and degree pathways
- Mastery-based progression and diagnostic placement
- Guided projects, labs, and portfolio work
- Searchable catalogs, learning paths, and role-based discovery
- Open courseware and free-access study paths
- Progress records, badges, and downloadable achievements
- AI-guided in-course support

## 4. Current Baseline

At the time of writing, Lyceum provides:

- A React and Vite single-page application
- Three hard-coded sample courses loaded from local JSON
- Module and section navigation via sidebar
- Text, video, quiz, and simple game content blocks
- Local progress tracking for completed sections
- Manual course switching

Current limitations relative to the target concept:

- No prompt-based content generation
- No AI tutor or conversational layer
- No agent roles or classroom simulation
- No adaptive sequencing
- No backend or persistent generated-course storage
- No authoring workflow beyond manual JSON edits

## 5. Users and Roles

### 5.1 Learner

The learner consumes generated or authored courses, navigates lessons, answers quizzes, asks questions, and receives adaptive support.

### 5.2 Instructor or Course Author

The instructor defines course goals, audience, duration, and style; reviews generated outlines and content; and publishes or revises courses.

### 5.3 Administrator

The administrator manages model configuration, moderation policies, storage, analytics access, and system-level controls.

## 6. Scope

### 6.1 In Scope

- Prompt-driven course generation
- Structured course outline generation and approval
- AI-generated lesson scenes and interactive blocks
- AI instructor persona
- Configurable supporting classroom agents
- Conversational learner help within course context
- Quiz generation, delivery, and feedback
- Adaptive pacing and remediation triggers
- Persistent storage of generated courses and learner progress
- Export of generated courses into a Lyceum-readable schema
- Internet knowledge base ingestion and cataloging
- Reliability, veracity, and provenance scoring for learning objects
- Dynamic per-learner course generation from a shared knowledge base
- Program, certification, and degree-equivalent knowledge paths
- Hands-on projects, labs, and portfolio artifacts
- Credentials, badges, transcripts, and skill records
- Search, filtering, and discovery across courses, programs, and source objects

### 6.2 Out of Scope for Initial Release

- Real-time multi-user classrooms
- Live human teacher co-teaching workflows
- Full avatar video synthesis or voice cloning
- LMS integration
- High-stakes exam proctoring
- Fully autonomous publishing without human review
- Formal university accreditation
- Copyright-infringing mirroring of third-party content

## 7. Functional Requirements

### 7.1 Prompt-Based Course Creation

- FR-1: The system shall allow an instructor or learner to create a course from a natural-language prompt.
- FR-2: The prompt flow shall collect at minimum topic, target audience, learning goals, difficulty level, expected duration, and preferred language.
- FR-3: The system shall support optional constraints such as teaching style, prerequisite knowledge, desired number of modules, and preferred assessment style.
- FR-4: The system shall generate a draft outline before generating full lesson content.
- FR-5: The system shall allow the user to accept, edit, regenerate, or partially regenerate the draft outline.

### 7.2 Course Structure Generation

- FR-6: The system shall generate a hierarchical course structure composed of course, module, section, and scene or block entities.
- FR-7: Generated content shall be stored in a structured schema compatible with Lyceum rendering.
- FR-8: Each generated section shall include explicit learning objectives.
- FR-9: Each section shall include at least one instructional block and, where appropriate, one knowledge-check or practice block.
- FR-10: The system shall preserve stable identifiers for generated modules and sections so learner progress can be tracked reliably.

### 7.3 Lesson Scene and Content Generation

- FR-11: The system shall generate lesson content that may include explanatory text, slides, quizzes, code examples, guided exercises, media embeds, or discussion prompts.
- FR-12: The system shall display generation progress states, including outline generation and page-content generation, so the user understands what is happening.
- FR-13: The system shall support partial regeneration of a single module, section, or scene without recreating the entire course.
- FR-14: The system shall support a review state where generated content is visible before publication or learner delivery.

### 7.4 Agent-Led Classroom Delivery

- FR-15: The system shall provide an AI instructor agent responsible for explaining material and guiding the lesson flow.
- FR-16: The system shall support optional secondary agents, including an assistant and one or more peer personas.
- FR-17: Each agent shall have configurable metadata including role, speaking style, voice setting, and pedagogical purpose.
- FR-18: The system shall support preset agent rosters and automatic role generation from course context.
- FR-19: During lesson delivery, the interface shall render agent contributions as part of the classroom experience rather than as disconnected chat messages.

### 7.5 Conversational Help and Interaction

- FR-20: The learner shall be able to ask questions during any lesson section.
- FR-21: Responses shall be grounded in the current course context and the current lesson section when possible.
- FR-22: The system shall support at least three response modes: concise answer, deeper explanation, and example-based explanation.
- FR-23: The instructor agent shall be able to summarize the current lesson, recap prior concepts, and preview upcoming material on request.

### 7.6 Adaptive Learning Behavior

- FR-24: The system shall track learner progress, quiz outcomes, and question patterns.
- FR-25: The system shall adapt instructional pacing based on learner signals such as repeated quiz errors, repeated clarification requests, or skipped content.
- FR-26: The system shall be able to insert remediation content, recap blocks, or extra practice when the learner demonstrates low mastery.
- FR-27: The system shall be able to advance more quickly when the learner demonstrates consistent mastery.
- FR-28: Adaptive changes shall be logged so they are inspectable by the learner or instructor.

### 7.7 Assessments

- FR-29: The system shall support single-answer and multiple-answer quizzes, matching current Lyceum capability.
- FR-30: The system should support short-answer and reflection prompts in a later phase.
- FR-31: The system shall provide immediate correctness feedback for auto-gradable items.
- FR-32: The system shall track section-level completion and mastery state separately.
- FR-33: The system shall allow instructors to require mastery or completion before the learner advances when course settings demand ordered progression.

### 7.8 Persistence and Reuse

- FR-34: The system shall persist generated courses beyond the current browser session.
- FR-35: The system shall persist learner progress independently from authored course content.
- FR-36: The system shall allow generated courses to be reopened, edited, duplicated, and exported.
- FR-37: The primary export format shall be JSON aligned with the Lyceum data model.
- FR-38: The system should support Markdown or PDF export in a later phase.

### 7.9 Authoring and Review Controls

- FR-39: Instructors shall be able to edit generated titles, objectives, text blocks, and assessments before publishing.
- FR-40: Instructors shall be able to lock sections against automatic regeneration after manual edits.
- FR-41: The system shall mark AI-generated content clearly in the authoring workflow.
- FR-42: The system shall provide a mechanism to report factual errors or unsafe outputs.

### 7.10 Analytics and Observability

- FR-43: The system shall capture learner events including section starts, section completions, quiz submissions, question asks, remediation inserts, and course exits.
- FR-44: The system shall expose a basic analytics summary for instructors, including completion rate, quiz accuracy, and most-questioned sections.
- FR-45: The system should surface generation diagnostics for failed or partial generations.

### 7.11 Learner Modeling and Personalization

- FR-46: The system shall maintain a learner profile that can include goals, prior knowledge, time budget, preferred modalities, accessibility needs, language, and career or credential intent.
- FR-47: The system shall support diagnostic assessment or self-placement so learners can begin at an appropriate starting point.
- FR-48: The learner profile shall influence content selection, pacing, modality mix, examples, and sequencing.
- FR-49: The system shall allow learners to specify constraints such as free-only content, open-license preference, source strictness, or target credential path.
- FR-50: Personalized generated course JSON shall be saved to learner metadata with version history.
- FR-51: The system shall allow a learner's course to be regenerated or updated without altering another learner's course snapshot.

### 7.12 Internet Knowledge Base and Cataloging

- FR-52: The system shall maintain a knowledge base of external learning objects that can be used to generate or assemble courses.
- FR-53: The system shall ingest or index public learning resources from the internet subject to licensing, robots, and copyright constraints.
- FR-54: The system shall classify knowledge objects by topic, prerequisites, learning outcomes, difficulty, audience, and language.
- FR-55: The system shall classify knowledge objects by learning content type, including text, video, quiz, lab, game, infographic, simulation, project, dataset, paper, book, audio, and reference material.
- FR-56: The system shall store per-object metadata including title, URL, author, publisher, license, cost or free status, estimated time, freshness, and last verification time.
- FR-57: The knowledge base shall deduplicate overlapping resources and track version or freshness updates over time.
- FR-58: The system shall support provider-level allowlists, blocklists, and human-curated collections.
- FR-59: The system shall support search and retrieval across knowledge objects, courses, and programs.

### 7.13 Reliability, Veracity, and Provenance

- FR-60: The system shall assign reliability or confidence metadata to each knowledge object.
- FR-61: Reliability or confidence metadata shall consider source type, publisher reputation, corroboration, recency, human review, and pedagogical quality.
- FR-62: Generated courses shall preserve citations from generated instructional blocks back to supporting knowledge objects where feasible.
- FR-63: Learners and instructors shall be able to inspect why a source was selected for a generated course.
- FR-64: The system shall flag, down-rank, or exclude low-confidence or conflicting material according to policy.
- FR-65: The system shall allow configurable source policies such as open-source-first, peer-reviewed-preferred, beginner-friendly, or high-trust-only.
- FR-66: The system shall periodically revalidate source links and mark stale or broken resources.

### 7.14 Dynamic Course, Path, and Program Generation

- FR-67: The system shall generate courses dynamically from the knowledge base plus learner profile; hard-coded repository courses shall be optional seeds or exemplars rather than required product content.
- FR-68: The system shall support hybrid generation in which a curated canonical course template is personalized for an individual learner.
- FR-69: The system shall support program-level entities composed of multiple courses, milestones, capstones, and credential checkpoints.
- FR-70: The system shall be able to generate complete knowledge paths that extend to certificate, career-track, or degree-equivalent journeys using free or open resources when feasible.
- FR-71: The system shall maintain prerequisite graphs that govern sequencing across courses and programs.
- FR-72: The system shall recommend next courses, modules, or remediation paths based on learner progress and goals.
- FR-73: A generated course snapshot shall be stored together with its source graph and generation recipe.
- FR-74: Learners shall be able to fork, refresh, freeze, or re-personalize a generated course snapshot.

### 7.15 Multimodal Practice, Labs, and Projects

- FR-75: The system shall support guided projects, hands-on labs, coding exercises, simulations, capstones, and portfolio artifacts.
- FR-76: When a modality requires tools or runtime support, the system should provide embedded or preconfigured environments where practical.
- FR-77: The system shall choose modality mixes based on learning objectives, learner preferences, and source availability.
- FR-78: The system shall allow instructors or curators to require hands-on evidence before course or section completion.
- FR-79: The system shall support upload, external linking, or structured submission of project evidence.
- FR-80: The system shall record completed projects and artifacts in a learner portfolio.

### 7.16 Credentials, Progress Records, and Discovery

- FR-81: The system shall support completion evidence including badges, certificates, transcripts, and skill records.
- FR-82: The system shall allow course and program outcomes to map to explicit competencies or skills.
- FR-83: The system shall provide a searchable catalog of courses, programs, and knowledge objects.
- FR-84: The catalog shall support filtering by domain, job role, degree target, modality, level, duration, language, cost, and trust rating.
- FR-85: The system shall support open or free filters and cost-aware path planning.
- FR-86: The system shall support role-based, career-based, and credential-based learning paths.
- FR-87: The system should support saved lists, bookmarks, and learning queues.

### 7.17 Social and Collaborative Learning

- FR-88: The system should support cohort mode, discussion threads, peer feedback, study groups, or mentor question and answer in later phases.
- FR-89: The system should support sharing portfolio projects or capstone outputs for review.
- FR-90: The system should support discussion prompts or reflective conversation attached to course sections.

### 7.18 Knowledge Object and Source Model

- FR-91: The system shall treat the knowledge object, not the URL alone, as the primary reusable unit for retrieval and course generation.
- FR-92: A single source URL may yield multiple knowledge objects, such as explanations, examples, transcript segments, exercises, projects, claims, or reference notes.
- FR-93: The platform shall maintain distinct entities for Source, Snapshot, Knowledge Object, Claim, and Path Graph node or edge records.
- FR-94: Source records shall track canonical URL, publisher, author, source type, license, fetch policy, baseline trust metadata, and archive references when available.
- FR-95: Snapshot records shall track fetched or indexed version, extraction status, content hash, timestamps, and freshness state.
- FR-96: Knowledge object records shall track concept scope, modality, difficulty, prerequisites, learning outcomes, estimated time, and suitability for different learner profiles.
- FR-97: Claim records should support statement-level extraction with supporting evidence, conflicting evidence, and confidence metadata when feasible.
- FR-98: Path graph records shall support composition of knowledge objects into lessons, courses, programs, checkpoints, and alternative routes.

### 7.19 Ingestion, Extraction, and Archival

- FR-99: The system shall prefer connector-based ingestion or indexing for supported providers before attempting generic scraping.
- FR-100: The system shall support domain-specific connectors for major source types such as video platforms, courseware sites, documentation sites, blogs, PDFs, slide decks, repositories, and structured feeds.
- FR-101: Generic headless browser scraping shall be used as a fallback rather than the primary ingestion strategy.
- FR-102: The ingestion pipeline shall extract structured metadata when available, including transcripts, headings, timestamps, quiz items, syllabus data, tags, captions, author, publisher, and publish date.
- FR-103: The platform shall preserve raw fetch artifacts, cleaned text artifacts, and structured extraction artifacts as separate layers.
- FR-104: The ingestion layer shall support advanced extraction capabilities where useful, including browser automation for JavaScript-heavy sites, transcript extraction, PDF and slide parsing, OCR for diagrams, table extraction, and sitemap or RSS ingestion.
- FR-105: The platform shall support change detection, recrawl scheduling, and source revalidation workflows.
- FR-106: The platform shall enforce domain-specific rate limits, robots compliance, and source-policy controls during ingestion.
- FR-107: The platform shall follow a reference-first archival strategy in which canonical URLs remain primary and backup archive references are stored when available or permitted.
- FR-108: When licensing or policy permits, the system may store extracted text or metadata and may record archive links such as Wayback references; when reuse is not permitted, the system shall retain only allowable metadata, excerpts, and source references.

### 7.20 Source Scoring, Knowledge Graph, Retrieval, and Coverage

- FR-109: The system shall separate source trust from content usefulness when ranking or selecting knowledge objects.
- FR-110: The platform shall score sources or knowledge objects across at least reliability, freshness, pedagogical quality, and accessibility dimensions.
- FR-111: The platform shall support corroboration logic so agreement or conflict across multiple sources can affect confidence and ranking.
- FR-112: The knowledge graph shall support explicit edge types including explains, requires, contradicts, demonstrates, assesses, extends, and alternative_to.
- FR-113: Retrieval for course generation shall use a hybrid strategy that can combine taxonomy filters, prerequisite graph traversal, lexical search, semantic retrieval, trust thresholds, and modality balancing.
- FR-114: Course generation shall retrieve structured learning packets or bundles of complementary knowledge objects rather than only a ranked list of documents.
- FR-115: When feasible, section assembly should target modality diversity by selecting at least an explanation, an example, an assessment, and a practice artifact for each important concept.
- FR-116: The platform shall maintain coverage maps for topics, subtopics, and programs.
- FR-117: Coverage maps shall identify where coverage is strong, where coverage is weak, where only low-confidence material exists, where sources are stale, and where modality diversity is missing.
- FR-118: The platform should support human curation workflows for correcting graph edges, source metadata, and coverage gaps.

### 7.21 Connector Execution and Compliance

- FR-119: The platform shall maintain a connector registry with per-provider extraction logic, versioning, and health status.
- FR-120: Each connector shall declare supported content types, licensing constraints, and data it can extract (transcripts, syllabus, metadata).
- FR-121: The ingestion scheduler shall enforce robots.txt, per-domain rate limits, and exponential backoff.
- FR-122: The platform shall provide a crawl policy layer that can allowlist/blocklist domains and throttle connectors globally.
- FR-123: The platform shall log ingestion provenance including connector version, fetch timestamps, and any compliance overrides.

### 7.22 Artifact Storage and Indexing

- FR-124: The platform shall store raw artifacts, cleaned text, and structured extraction outputs in object storage with immutable identifiers.
- FR-125: Artifact records shall reference storage URIs, content hashes, and retention policy metadata.
- FR-126: The platform shall support excerpt-only storage for sources that prohibit full reuse, while still capturing metadata and citations.
- FR-127: The platform shall provide a purge workflow to remove artifacts when licensing or policy requires deletion.

### 7.23 Semantic and Hybrid Retrieval

- FR-128: The platform shall generate embeddings for knowledge objects and store them in a vector index.
- FR-129: Retrieval shall support hybrid ranking that combines lexical search, vector similarity, trust thresholds, and modality balancing.
- FR-130: Retrieval shall support caching of learning packets to avoid recomputation for frequent prompts.
- FR-131: Retrieval shall expose explainable ranking signals for why objects were selected.

### 7.24 Generation Runtime and Versioning

- FR-132: The system shall support pluggable model providers with versioned prompt templates and model selection policy.
- FR-133: The system shall store generation inputs, selected sources, and model parameters as an auditable trace.
- FR-134: The system shall support evaluation checks for generated content (structure validity, coverage, safety signals).
- FR-135: The system shall support regeneration with stable IDs to preserve learner progress.

### 7.25 Moderation and Review Workflow

- FR-136: The system shall provide a review queue for generated courses before publication when required.
- FR-137: The system shall allow instructors to flag unsafe or incorrect blocks with required justification.
- FR-138: The system shall support content lock and override states to prevent automatic regeneration of reviewed content.

### 7.26 Security, Roles, and Multi-Tenancy

- FR-139: The platform shall support authentication for learners, instructors, and administrators.
- FR-140: The platform shall enforce role-based access control for authoring, curation, and administrative actions.
- FR-141: The system shall isolate learner data across tenants or organizations when deployed in multi-tenant mode.

### 7.27 Observability and Operations

- FR-142: The platform shall emit structured logs for ingestion, retrieval, generation, and worker jobs.
- FR-143: The platform shall expose metrics and tracing for latency, success rates, and queue depth.
- FR-144: Background jobs shall support retries, exponential backoff, and dead-letter queues.

### 7.28 Data Lifecycle and Infrastructure

- FR-145: The platform shall support database migrations and schema versioning.
- FR-146: The platform shall support automated backups and restore procedures for core data stores.
- FR-147: The platform shall provide retention policies for learner data, artifacts, and logs.

### 7.29 Frontend Integration and UX

- FR-148: The learner UI shall surface citations and source explanations for each generated section.
- FR-149: The learner UI shall show generation state and allow outline review before full generation.
- FR-150: The learner UI shall sync progress and analytics events to the backend.
- FR-151: The learner UI shall support loading dynamic courses generated by the backend alongside local exemplars.

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

Lyceum should retain JSON as its canonical content contract. The schema shall be extended to support the new concept instead of replaced.

Minimum schema additions:

- Course metadata: prompt, target audience, duration, language, difficulty, generation status, version
- Agent roster: id, name, role, style, voice, enabled state
- Learning objectives: course-level and section-level objectives
- Scene metadata: scene type, narration text, estimated duration, mastery checkpoint
- Assessment metadata: rubric, answer type, feedback, remediation hook
- Adaptation metadata: inserted recap, skipped section, regenerated explanation, confidence marker
- Audit metadata: created by, reviewed by, last regenerated at, locked state
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

- Lyceum shall be the learner-facing application layer, including public product surfaces, learner accounts, course experience, AI classroom interaction, progress, portfolio, and credential views.
- Protheus platform services shall be the underlying knowledge-platform layer, including ingestion, extraction, cataloging, trust scoring, graph construction, retrieval, and generation orchestration.
- Lyceum and Protheus platform services should remain in the same repository during the early product phase but shall be implemented as separate deployable applications or services with clear boundaries.
- Shared schemas, contracts, and libraries shall be versioned and consumed by both Lyceum and Protheus platform services through internal packages rather than ad hoc duplication.

### 10.2 Front End

- The front end shall remain a React-based client application.
- The current renderer shall be refactored so authored and generated courses use the same rendering pipeline.
- The interface shall introduce a classroom mode that can present agent dialogue, lesson scenes, and inline learner interaction.

### 10.3 Backend

- A backend service shall be introduced for generation, persistence, and analytics.
- The backend shall orchestrate outline generation, scene generation, assessment generation, and adaptive decision logic.
- The backend shall expose APIs for course creation, regeneration, retrieval, progress updates, and conversation turns.

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

## 11. Release Phasing

### Phase 0: Knowledge Platform Foundation

- Knowledge base ingestion or indexing
- Connector framework and fallback scraping pipeline
- Source taxonomy and modality classification
- Knowledge object decomposition and claim extraction
- Provenance and trust-scoring model
- Canonicalization, deduplication, and archive-reference strategy
- Hybrid retrieval and prerequisite graph foundation
- Coverage-map foundation
- Learner profiles and preference capture
- Versioned storage for generated course snapshots

### Phase 1: Prompt-to-JSON MVP

- Prompt intake
- Outline generation and review
- Full course generation into Lyceum JSON using knowledge-base sources
- Persistent generated-course storage
- Existing content renderer reused for generated content
- Source citations and generation trace saved with each course

### Phase 2: Agentic Classroom

- AI instructor
- Configurable assistant and peer personas
- Classroom mode UI
- Contextual learner Q and A
- Narration and transcript support

### Phase 3: Adaptive Learning

- Mastery tracking
- Dynamic remediation
- Pace adjustment
- Instructor analytics
- Regeneration of weak sections from learner feedback

### Phase 4: Programs and Credentials

- Multi-course learning paths
- Degree-equivalent program generation
- Badges, certificates, and transcripts
- Portfolio and capstone tracking
- Catalog discovery and next-course recommendation

## 12. Acceptance Criteria

Lyceum will satisfy this SRS for the first meaningful milestone when all of the following are true:

- A user can describe a course in natural language and receive a structured outline.
- The generated course is assembled from knowledge-base objects with stored provenance.
- The outline can be approved or edited before full generation.
- The approved course can be generated into a Lyceum-readable JSON structure.
- The generated course can be opened in the application and navigated section by section.
- The course includes generated assessments.
- An AI instructor can answer questions within the context of the active lesson.
- Learner progress and generated courses persist across sessions.
- A learner can request a free or open-biased path and the generator respects that constraint when feasible.
- The generated course snapshot is saved to learner metadata and can be reopened or regenerated later.
- The UI clearly distinguishes generation, delivery, and review states.

## 13. Risks and Open Questions

- Hallucination risk: generated teaching content may be wrong or misleading without grounding or review.
- Quality variance: generated sections may vary in depth, tone, and pedagogical usefulness.
- Cost control: multi-step generation and conversational tutoring may become expensive at scale.
- Scope creep: multi-agent classrooms can expand into avatars, voice synthesis, and real-time orchestration too early.
- Evaluation gap: Lyceum will need objective ways to judge whether generated lessons are actually effective.
- Licensing risk: internet resources may not always be reusable in full, even when they are educational.
- Link rot risk: source URLs and free resources may disappear or change over time.
- Trust-model bias: reliability scoring may incorrectly favor or suppress certain source categories.
- Product-language risk: "degree-equivalent" learning paths must not be confused with accredited degrees.
- Extraction risk: automated parsing may mis-segment content or infer incorrect knowledge objects or claims.
- Scraping risk: generic scraping can be brittle, expensive, or blocked if connector coverage is weak.

Open questions for future revision:

- Should Lyceum prioritize instructor-authored source materials as grounding input?
- Should peer agents be visible by default or optional for focus-sensitive learners?
- What level of human review is required before a generated course is publishable?
- Which learner analytics are necessary versus merely interesting?
- How much third-party content should be indexed, excerpted, or mirrored versus linked out?
- Should Lyceum maintain canonical public paths as well as fully private learner-specific paths?
- Which source connectors should be first-class in the initial repository build-out?
- How much claim-level extraction is worth doing in early versions versus object-level extraction only?

## 14. References

- Video concept reference: https://x.com/ai_for_success/status/2033184400452821131?s=20
- Tsinghua University overview: https://www.tsinghua.edu.cn/en/info/1245/14044.htm
- Research paper: https://arxiv.org/abs/2409.03512
- Coursera degrees: https://www.coursera.org/degrees
- Coursera guided projects: https://www.coursera.org/campus/guided-projects
- edX certificates and stackable credentials: https://www.edx.org/certificates
- edX MicroBachelors: https://www.edx.org/bachelors/microbachelors
- Khan Academy mastery: https://support.khanacademy.org/hc/en-us/articles/360037127892
- Udemy AI Assistant: https://blog.udemy.com/accelerate-your-career-growth-with-udemy-ai-assistant/
- Udemy coding exercises: https://support.udemy.com/hc/en-us/articles/229606768-Learning-With-Coding-Exercises
- LinkedIn Learning certificates: https://www.linkedin.com/help/linkedin/answer/a705867
- LinkedIn Learning professional certificates: https://www.linkedin.com/learning/topics/professional-certificates
- Pluralsight Skill IQ: https://help.pluralsight.com/hc/en-us/articles/24420144243604-Taking-a-Skill-IQ
- Pluralsight Labs: https://help.pluralsight.com/hc/en-us/articles/24356159003924-Labs-overview
- Codecademy career paths: https://www.codecademy.com/cohorts/full-stack-engineer-career-path
- Codecademy projects: https://www.codecademy.com/projects
- FutureLearn platform overview: https://www.futurelearn.com/
- MIT OpenCourseWare course materials: https://ocw.mit.edu/courses/16-001-unified-engineering-materials-and-structures-fall-2021/pages/lecture-notes/
- OpenLearn free course catalogue: https://www.open.edu/openlearn/free-courses/full-catalogue
- OpenLearn badges: https://www.open.edu/openlearn/badged-courses

## 7. Functional Requirements

### 7.1 Prompt-Based Course Creation

- FR-1: The system shall allow an instructor or learner to create a course from a natural-language prompt.
- FR-2: The prompt flow shall collect at minimum topic, target audience, learning goals, difficulty level, expected duration, and preferred language.
- FR-3: The system shall support optional constraints such as teaching style, prerequisite knowledge, desired number of modules, and preferred assessment style.
- FR-4: The system shall generate a draft outline before generating full lesson content.
- FR-5: The system shall allow the user to accept, edit, regenerate, or partially regenerate the draft outline.
- FR-5a: The course-creation interface shall block generation and direct the user to settings when no verified active provider key and model are connected.

### 7.2 Course Structure Generation

- FR-6: The system shall generate a hierarchical course structure composed of course, module, section, and scene or block entities.
- FR-7: Generated content shall be stored in a structured schema compatible with Lycium rendering.
- FR-8: Each generated section shall include explicit learning objectives.
- FR-9: Each instructional section shall include at least one instructional block. Knowledge checks and quizzes shall be generated as separate assessment sections.
- FR-10: The system shall preserve stable identifiers for generated modules and sections so learner progress can be tracked reliably.

### 7.3 Lesson Scene and Content Generation

- FR-11: The system shall generate lesson content that may include explanatory text, slides, code examples, guided exercises, media embeds, or discussion prompts. Quizzes shall be generated as separate assessment content, not mixed into instructional lesson sections.
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

- FR-29: The system shall support single-answer and multiple-answer quizzes, matching current Lycium capability.
- FR-30: The system should support short-answer and reflection prompts in a later phase.
- FR-31: The system shall provide immediate correctness feedback for auto-gradable items.
- FR-32: The system shall track section-level completion and mastery state separately.
- FR-33: The system shall allow instructors to require mastery or completion before the learner advances when course settings demand ordered progression.

### 7.8 Persistence and Reuse

- FR-34: The system shall persist generated courses beyond the current browser session.
- FR-35: The system shall persist learner progress independently from authored course content.
- FR-36: The system shall allow generated courses to be reopened, edited, duplicated, and exported.
- FR-37: The primary export format shall be JSON aligned with the Lycium data model.
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
- FR-74a: The system shall derive course and program requirements from curriculum benchmarks, including university catalogs, syllabi, certification outlines, employer skill profiles, and expert-reviewed references.
- FR-74b: The system shall preserve requirement origin metadata that explains why a requirement exists and which benchmark, source, certification, employer profile, or reviewer supports it.
- FR-74c: The system shall classify requirements as required, recommended, optional, remedial, alternate-path, or enrichment material.
- FR-74d: The system shall support equivalent course variants that satisfy the same requirement through different modality, pacing, source set, or pedagogy profiles.
- FR-74e: The system shall support source slots with primary and fallback sources for required concepts so broken or weak sources can be replaced without changing the requirement.

### 7.15 Multimodal Practice, Labs, and Projects

- FR-75: The system shall support guided projects, hands-on labs, coding exercises, simulations, capstones, and portfolio artifacts.
- FR-76: When a modality requires tools or runtime support, the system should provide embedded or preconfigured environments where practical.
- FR-77: The system shall choose modality mixes based on learning objectives, learner preferences, and source availability.
- FR-78: The system shall allow instructors or curators to require hands-on evidence before course or section completion.
- FR-79: The system shall support upload, external linking, or structured submission of project evidence.
- FR-80: The system shall record completed projects and artifacts in a learner portfolio.
- FR-80a: Career-path and degree-equivalent programs shall include portfolio artifact requirements unless a reviewer explicitly marks them not applicable.

### 7.16 Credentials, Progress Records, and Discovery

- FR-81: The system shall support completion evidence including badges, certificates, transcripts, and skill records.
- FR-82: The system shall allow course and program outcomes to map to explicit competencies or skills.
- FR-83: The system shall provide a searchable catalog of courses, programs, and knowledge objects.
- FR-84: The catalog shall support search over course names, tags, and descriptions; filtering by top-level college or school; sorting by type and progress; and later filtering by domain, job role, degree target, modality, level, duration, language, cost, and trust rating.
- FR-84a: The catalog shall maintain a university-style college taxonomy and nested department taxonomy so courses can be classified first by college/school and later by department.
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

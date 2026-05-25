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
- Full course generation into Lycium JSON using knowledge-base sources
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

Lycium will satisfy this SRS for the first meaningful milestone when all of the following are true:

- A user can describe a course in natural language and receive a structured outline.
- The generated course is assembled from knowledge-base objects with stored provenance.
- The outline can be approved or edited before full generation.
- The approved course can be generated into a Lycium-readable JSON structure.
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
- Evaluation gap: Lycium will need objective ways to judge whether generated lessons are actually effective.
- Licensing risk: internet resources may not always be reusable in full, even when they are educational.
- Link rot risk: source URLs and free resources may disappear or change over time.
- Trust-model bias: reliability scoring may incorrectly favor or suppress certain source categories.
- Product-language risk: "degree-equivalent" learning paths must not be confused with accredited degrees.
- Extraction risk: automated parsing may mis-segment content or infer incorrect knowledge objects or claims.
- Scraping risk: generic scraping can be brittle, expensive, or blocked if connector coverage is weak.

Open questions for future revision:

- Should Lycium prioritize instructor-authored source materials as grounding input?
- Should peer agents be visible by default or optional for focus-sensitive learners?
- What level of human review is required before a generated course is publishable?
- Which learner analytics are necessary versus merely interesting?
- How much third-party content should be indexed, excerpted, or mirrored versus linked out?
- Should Lycium maintain canonical public paths as well as fully private learner-specific paths?
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

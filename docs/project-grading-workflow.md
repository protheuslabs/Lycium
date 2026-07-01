# Project grading workflow

Lycium project grading is a backend workflow, not a front-end-only UI behavior. Project blocks define the assignment, rubric, submission policy, and grader workflow metadata. Learner/project data stores the submitted artifact record, grade report, and comment thread.

## Current native workflow

The first native workflow is intentionally narrow:

1. Extract submission text from text fields and lightweight submission metadata.
2. Normalize the project rubric.
3. Compare submission text to required evidence signals.
4. Score each rubric criterion deterministically.
5. Return a structured grade report and optional review-needed errors.
6. Add grader feedback to the project comment flow.

The native workflow can grade plain text submissions enough to test the product loop. It can also extract text from TXT, PDF, and DOCX uploads submitted through the course UI. Link-only submissions are recorded, but marked as requiring review until a fetcher can inspect the linked artifact content. Unsupported uploads, image-only uploads, corrupt files, or files without extractable text fail closed with a visible tool/extraction error.

Native grading is not an Ollama/cloud-LLM call. Until an agent-grader adapter is added, Lycium returns `grader: native_text_grader` and records the requested grader separately in the trace. This avoids presenting deterministic local scoring as a connected model result.

The native grader must fail closed:

- unreadable/gibberish text receives `0` and `needs_review`;
- text that does not match the project prompt/rubric receives `0` and `needs_review`;
- link-only or unsupported/corrupt file submissions receive a clear extraction/tooling error until the relevant reader exists;
- rubric criterion scores are whole points, never fractional points.

## Required future tools

- Submission reader for text, files, links, images, repos, and documents.
- Course context retriever for the current project, prior lessons, concepts, sources, and outcomes.
- Rubric evaluator that returns criterion-level scores, evidence, and feedback.
- Source checker for validating source use and concept grounding.
- Sandbox runner for code, tests, notebooks, or executable labs.
- Structured grade writer for grade reports, comments, learner progress, and portfolio evidence.
- Human handoff path when grading confidence is low or the required tool fails.

## Protheus ecosystem boundary

Native Lycium grading tools are temporary primitives. As Infring OS or other Protheus ecosystem tools mature, Lycium should delegate file reading, artifact inspection, sandbox execution, retrieval, and grader orchestration to those primitives through stable adapters. The course/project contract should remain stable while the underlying tools can be replaced.

# Golden course templates

Lycium keeps course-specific evaluation examples in a data-only golden dataset:

- `services/lycium-api/app/course_generation_golden_dataset.json`

The generator should not contain named-course branches for macroeconomics, chemistry, biology, or any other domain. A generated course can be tested against a template by passing its artifact into the generic scenario evaluator.

The current course-template set is:

- Macroeconomics Principles
- Intro Programming Foundations
- Software Engineering Methods
- Academic Writing and Research Composition
- General Biology Foundations
- Introductory Statistics
- Environmental Science Foundations
- Art History Survey
- Financial Accounting Principles
- Public Speaking and Communication

Each template records expected taxonomy, course-shape thresholds, required topic keywords, and optional benchmark/source records. Those records are acceptance examples, not generation shortcuts.

The source-grounding gate also rejects courses that rely only on a blanket course-level source list. A passing generated draft must map sources to source slots, sections, and sourceable blocks so the renderer and review workflow can show only the citations that support the current page.

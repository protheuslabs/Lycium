# Data Use and Trust

Lycium's mission depends on trust. The product should be clear about what data is public curriculum infrastructure, what data belongs to learners, and what can improve the Protheus ecosystem.

## Data classes

### Public source and curriculum data

This data is intended to become reusable infrastructure:

- source URLs and canonical source records
- source snapshots, hashes, and extracted text
- curriculum benchmarks from catalogs, syllabi, certifications, and employer profiles
- requirement origins and commonality signals
- source slots and fallback rankings
- concept graphs and prerequisite edges
- source quality and course health signals

This data may feed Lycium course/program generation and other Protheus systems such as research tooling, retrieval, evals, and knowledge graphs.

### Generated learning artifacts

These artifacts are product outputs:

- course snapshots
- program snapshots
- quizzes and rubrics
- project and portfolio requirements
- generation traces
- quality reports

Generated artifacts should preserve source provenance and stable source-index references so they can be reviewed, reproduced, and revised.

### Private learner data

This data belongs to the learner:

- progress and completion records
- quiz attempts and mistakes
- bookmarks and notes
- goals and preferences
- feedback tied to a person
- portfolio submissions
- career or employment outcomes
- API keys and local provider settings

Private learner data should be exportable and deletable. Local editable course drafts, imported draft files, fork metadata, and unsynced authoring changes should be treated as private user-owned data until the user explicitly publishes, shares, or submits them for review. Private learner and draft data should not feed external training, benchmarking, or ecosystem analytics without explicit consent and clear controls.

## Trust rules

### Separate public evidence from private behavior

Lycium should prefer public curriculum/source data as its ecosystem contribution. Sensitive learner behavior requires a higher consent bar.

### Preserve provenance

Courses and programs should record:

- source public IDs
- snapshot public IDs
- benchmark IDs
- requirement origin evidence
- source slots
- generation traces
- quality reports

This lets learners and reviewers inspect why a course exists in its current form.

### Avoid hidden surveillance incentives

The business and product model should not depend on silently harvesting learner weaknesses, study habits, or personal goals.

Useful aggregate learning signals can exist later, but they should be consented, minimized, and separated from identity wherever possible.

### Keep secrets local-first

API keys and local model endpoints should stay in local user data stores by default. Future hosted deployments should use dedicated secret storage rather than general application tables.

### Make contribution transparent

If users suggest sources, review courses, rate source quality, or contribute corrections, Lycium should show how those contributions affect course health and source quality.

## Protheus ecosystem boundary

Good ecosystem data:

- public source records
- curriculum structures
- concept/prerequisite graphs
- source quality signals
- benchmark and parity maps
- rubrics and project requirements

Sensitive ecosystem data:

- individual learner mistakes
- study habits
- personal goals
- employment outcomes
- demographic or identity-linked records

Lycium should feed Protheus primarily with the first category. The second category needs explicit consent, strong controls, and clear user value.

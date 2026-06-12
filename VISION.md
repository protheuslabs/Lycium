# Lycium Product Vision

## Mission

Turn the internet's best knowledge into trustworthy, personalized, complete learning paths.

## Core Problem

The internet already contains enough material for someone to learn almost anything. The problem is that the information is fragmented, inconsistent, uneven in quality, poorly sequenced, and difficult to turn into a complete knowledge path. Learners are forced to act as their own curriculum designer, fact checker, tutor, and archivist.

## Product Thesis

Lycium should not primarily be a repository of hard-coded courses.

Lycium should become a knowledge platform that:

- catalogs learning objects from the internet
- classifies them by topic, difficulty, modality, prerequisites, and learning outcomes
- scores them by reliability, veracity, freshness, and usefulness
- assembles them into personalized courses and multi-course programs
- teaches those courses through an adaptive AI classroom interface
- saves the resulting course JSON as a learner-specific artifact that can evolve over time

## Product / Platform Split

Lycium should be the learner-facing product surface.

Lycium backend should be the underlying knowledge infrastructure.

In practice:

- Lycium web is the public and learner-facing application.
- Lycium backend handles ingestion, cataloging, trust scoring, retrieval, graphing, and generation.
- Lycium is the visible application and the deeper knowledge asset that makes the product defensible.

## Strategic Bet

The differentiator is not merely "AI-generated courses."

The differentiator is a reliability-aware curriculum engine built on top of a multimodal knowledge base. That engine should be able to generate:

- a single lesson
- a focused course
- a career path
- a certification-prep track
- a degree-equivalent learning journey built from free or open resources where feasible

## Long-Term Product Shape: Learning Operating System

Lycium's long-term direction is broader than course generation. If the project succeeds, it can become a learning operating system: a single environment that combines open education, LMS-style course delivery, program planning, registration-like coordination, and reusable knowledge infrastructure.

The near-term mission remains simple: make free internet knowledge usable for real skill development. The later institutional ambition should grow from that mission, not distract from it.

### Open Education Layer

Lycium should organize public and free educational material into coherent pathways:

- source-backed lessons, courses, and programs
- prerequisite chains and concept graphs
- required, recommended, optional, remedial, and alternate-path content
- projects, assessments, rubrics, and portfolio evidence
- transparent provenance and source quality signals

This layer is the spine of the product. It makes free education more practical by turning scattered material into vertical understanding.

### LMS Layer

Lycium should eventually be able to replace course software such as Canvas for compatible learning environments. That means supporting:

- course delivery through modules, sections, blocks, assignments, quizzes, projects, and discussions or cohorts later
- instructor, reviewer, or curator workflows
- feedback, grading-like review, rubric evidence, announcements, and learner support
- progress, mastery, submissions, and course health

This should be built from Lycium's existing portable course artifacts rather than as a separate LMS silo.

### Program Planning Layer

Lycium should also support the planning functions usually split across advising, degree audit, and registration systems:

- programs, requirement groups, clusters, tracks, electives, capstones, and bridge/remedial work
- prerequisites and dependency graphs
- equivalent courses or alternate course variants that satisfy the same requirement
- requirement completion, remaining work, blocked courses, and recommended next courses
- estimated time and effort at section, course, cluster, program, and learner-plan levels

This layer is how Lycium moves from "course catalog" to "complete education path."

### Registration and Cohort Layer

Institution-style registration should be a later capability, not an early distraction. When needed, Lycium should support:

- learner enrollment into programs, cohorts, course sections, or self-paced paths
- schedules, pacing, deadlines, capacity, waitlists, and instructor/reviewer assignment
- transcript-like records and portable achievement evidence

The early product should avoid copying university bureaucracy. Registration primitives should exist only when they help learners access, sequence, and complete learning.

### Knowledge Infrastructure Layer

Lycium should feed and benefit from the broader Protheus ecosystem through public, reusable knowledge infrastructure:

- Source Index records and snapshots
- curriculum benchmarks and requirement origins
- source slots, fallback sources, and source replacement signals
- source request and source packet quality reports
- concept and prerequisite graphs
- generation evals, course health, and artifact quality signals

Private learner data remains a separate trust zone. The clean ecosystem asset is public curriculum/source structure, not silent extraction from learner behavior.

### Sequencing Principle

Lycium should evolve in this order:

1. Become excellent at turning sources into local, editable, source-backed courses and programs.
2. Become excellent at planning full learning paths from requirements, prerequisites, and source evidence.
3. Add LMS workflows for review, assignments, feedback, cohorts, and course operation.
4. Add registration and institutional planning features only after the open education and planning primitives are solid.

The product should not become "school administration software" before it becomes the best way to turn free knowledge into capability.

## What Lycium Should Feel Like

For the learner:

- I can say what I want to learn and why.
- The system builds a path that matches my current level, schedule, and preferred learning style.
- I can see where each part of the course came from and how trustworthy it is.
- I get a complete path, not a pile of links.
- I can move from explanation to quiz to project to recap without leaving the learning flow.

For the curator or instructor:

- I can shape the source policy and learning standards.
- I can review, refine, and publish canonical paths.
- I can let learners fork those paths into personalized versions without losing the original.

## Product Pillars

### 1. Knowledge Base

Lycium needs a durable knowledge layer that stores:

- source metadata
- topic and prerequisite graphs
- modality classification
- trust and provenance data
- reusable learning objects

### 2. Curriculum Engine

Lycium needs to convert knowledge objects into structured courses, programs, and checkpoints rather than leaving information as raw search results.

### 3. Adaptive Classroom

Lycium needs an instructional surface that can teach, explain, assess, remediate, and guide.

### 4. Persistent Learning Record

Lycium needs to remember what a learner studied, what was generated for them, what they mastered, and what they should learn next.

## What This Means for Content

Hard-coded courses should become seed content, test fixtures, or curated exemplars.

The long-term product should generate most learner-facing courses dynamically from the knowledge base and save those personalized courses as versioned course JSON tied to the learner profile.

## Relationship to Other Docs

- `README.md` should stay short and explain what the repo is and where to start.
- `VISION.md` should describe the product thesis and long-term direction.
- `SRS.md` should translate that thesis into implementable requirements.
- `ARCHITECTURE.md` should describe the system boundary, stack, deployables, and repo structure.

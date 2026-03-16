# Lyceum Product Vision

## Mission

Turn the internet's best knowledge into trustworthy, personalized, complete learning paths.

## Core Problem

The internet already contains enough material for someone to learn almost anything. The problem is that the information is fragmented, inconsistent, uneven in quality, poorly sequenced, and difficult to turn into a complete knowledge path. Learners are forced to act as their own curriculum designer, fact checker, tutor, and archivist.

## Product Thesis

Lyceum should not primarily be a repository of hard-coded courses.

Lyceum should become a knowledge platform that:

- catalogs learning objects from the internet
- classifies them by topic, difficulty, modality, prerequisites, and learning outcomes
- scores them by reliability, veracity, freshness, and usefulness
- assembles them into personalized courses and multi-course programs
- teaches those courses through an adaptive AI classroom interface
- saves the resulting course JSON as a learner-specific artifact that can evolve over time

## Product / Platform Split

Lyceum should be the learner-facing product surface.

Protheus platform should be the underlying knowledge infrastructure.

In practice:

- Lyceum is the public and learner-facing application.
- Protheus handles ingestion, cataloging, trust scoring, retrieval, graphing, and generation.
- Lyceum is the main visible application, but Protheus is the deeper asset that makes it defensible.

## Strategic Bet

The differentiator is not merely "AI-generated courses."

The differentiator is a reliability-aware curriculum engine built on top of a multimodal knowledge base. That engine should be able to generate:

- a single lesson
- a focused course
- a career path
- a certification-prep track
- a degree-equivalent learning journey built from free or open resources where feasible

## What Lyceum Should Feel Like

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

Lyceum needs a durable knowledge layer that stores:

- source metadata
- topic and prerequisite graphs
- modality classification
- trust and provenance data
- reusable learning objects

### 2. Curriculum Engine

Lyceum needs to convert knowledge objects into structured courses, programs, and checkpoints rather than leaving information as raw search results.

### 3. Adaptive Classroom

Lyceum needs an instructional surface that can teach, explain, assess, remediate, and guide.

### 4. Persistent Learning Record

Lyceum needs to remember what a learner studied, what was generated for them, what they mastered, and what they should learn next.

## What This Means for Content

Hard-coded courses should become seed content, test fixtures, or curated exemplars.

The long-term product should generate most learner-facing courses dynamically from the knowledge base and save those personalized courses as versioned course JSON tied to the learner profile.

## Relationship to Other Docs

- `README.md` should stay short and explain what the repo is and where to start.
- `VISION.md` should describe the product thesis and long-term direction.
- `SRS.md` should translate that thesis into implementable requirements.
- `ARCHITECTURE.md` should describe the system boundary, stack, deployables, and repo structure.

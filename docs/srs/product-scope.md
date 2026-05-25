# Lycium Software Requirements Specification

## 1. Purpose

This Software Requirements Specification (SRS) defines the target product direction for Lycium.

Lycium currently exists as a lightweight React application that renders course content from local JSON files. This SRS extends that baseline by assimilating the concept demonstrated in the linked OpenMAIC video and by benchmarking major online course platforms. The target product is a prompt-driven, reliability-aware learning system that can catalog internet knowledge, assemble structured courses and programs, and deliver agent-led, adaptive instruction instead of only static content pages.

This document is intentionally written as an adaptation for Lycium, not as a direct clone of OpenMAIC. The goal is to preserve Lycium's strongest architectural trait, structured content rendered from JSON, while evolving the product into an AI-assisted learning platform.

## 2. Product Vision

Lycium shall evolve from a static, JSON-backed course viewer into a knowledge platform and prompt-to-classroom learning system with these core behaviors:

- A learner or instructor can describe a course, learning goal, or full knowledge path in natural language.
- The system catalogs and classifies learning resources from the internet into a structured knowledge base.
- The system decomposes sources into reusable knowledge objects instead of treating URLs as the only unit of retrieval.
- The system generates a course outline, lesson scenes, quizzes, projects, and supporting assets from that knowledge base and the user's profile.
- An AI instructor guides the learner through the material.
- Optional supporting agents, such as an assistant or peer personas, create a more interactive classroom dynamic.
- The system adapts pace, explanations, and practice based on learner behavior and performance.
- Generated output remains serializable into a structured Lycium course schema so it can be rendered, edited, versioned, and reused.
- Courses do not need to be hard-coded in the product repository; they can be generated dynamically per learner and saved as versioned course JSON in learner metadata.
- Lycium should be able to assemble multi-course programs, including degree-equivalent knowledge paths built primarily from free or open internet resources where feasible.

## 3. Source Concept Assimilation

The concept assimilated from the linked video and source material is:

- Prompt-to-course generation should create more than slides. It should generate a complete learning path.
- The classroom should include role-based agents, not just one chatbot.
- The learner should experience guided teaching, discussion, and assessment in one interface.
- The system should show visible generation stages, such as outline generation and page-content generation.
- The classroom should feel interactive and adaptive rather than like passive video playback.

For Lycium, this translates into four product pillars:

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

At the time of writing, Lycium provides:

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
- Export of generated courses into a Lycium-readable schema
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


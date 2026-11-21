# Brilliant: Active Practice Without Gamification

Date: 2026-11-21. Eighth focused study after Coursera, Khan Academy, Udemy, Canvas, edX, MIT OpenCourseWare, and OpenLearn.

## Evidence And Limits

Inspected Brilliant's [public home](https://brilliant.org/), [topic catalog](https://brilliant.org/courses/), and public [Visual Algebra course map](https://brilliant.org/courses/systems-of-equations/). Expanded the Algebra Fundamentals topic and reviewed its named courses. The course map exposes levels, lesson sequences, level checks, exercise/lesson counts, description, and prerequisites. The [learning-path guide](https://brilliant.org/help/features/what-are-learning-paths/) remains the documented reference for sequenced explanations, hands-on problems, and checkpoints.

### Authenticated Player Follow-Up

After the user signed in, inspected the actual `Building Patterns` lesson player without submitting an answer or changing account settings. The player presented one central interactive pattern task, a small Close control, a question heading, `I don't know`, and a disabled `Check` action. A separate tutor-introduction layer offered voice/setup controls; those settings were left untouched. This is direct evidence for the focused task layout, but not a test of grading quality, hints, adaptive review, or learning outcomes.

## Observations And Adaptations

| Area | Observation | Lycium adaptation |
| --- | --- | --- |
| Active learning | The product emphasizes guided problems and checkpoints rather than passive reading alone. | Surface real pending quizzes/projects/assessments in My Learning and link directly to them. |
| Focused player | The authenticated lesson places one interactive task in a restrained workspace with a small exit. | Preserve Lycium's dedicated lesson toolbar and Focus Mode. Do not force its full-assessment format into a one-question player without a product decision. |
| Input state | Check is disabled until input exists; `I don't know` is an explicit alternative. | Add a learner-controlled One at a time / All questions layout. Save an explicit unsure response per attempt/question, without treating it as a correct answer. |
| Sequence | Public course maps group named lessons into levels and include level checks. | Preserve Lycium's module/section sequence, activity labels, and prerequisite locks without inventing a second leveling system. |
| Course scope | The course map provides description, prerequisites, and content counts. | Retain existing overview outcomes, curriculum, effort, assessments, and instruction facts. |
| Feedback | Public marketing describes adaptive review and mastery. | Do not claim mastery, adaptive remediation, tutoring, or skill targeting without a valid model and evidence. |
| Motivation | XP, streaks, leagues, and promotional onboarding are prominent parts of the broader product. | Do not add gamification or marketing mechanics to the academic reader. |

## Implemented Boundaries

- My Learning conditionally shows `Practice & assessment` only when active courses have an unlocked, incomplete assessment-like section.
- One next item per active course is selected from current curriculum and course-scoped resolved statuses.
- Completed and prerequisite-locked sections are excluded. Lesson and summary sections are not mislabeled as practice.
- Each row opens the real section through the existing course-scoped route/bookmark behavior.
- No new assessment, grading, mastery, recommendation, or AI-tutoring behavior is implied.
- Active attempts support Previous/Next question navigation and an All questions alternative. The selected layout and current question persist through reloads.
- `I don't know` clears a selection, is included in attempt history/review, and satisfies the requirement to resolve every question before submission. Existing scoring remains unchanged: an empty selection is not correct.

## Verification

Unit coverage includes pending, completed, and prerequisite-locked assessment states. Desktop/mobile browser coverage verifies the real Practice & assessment list, course identity, and direct section navigation. Existing assessment persistence, feedback, and course-isolation suites remain the grading/attempt guardrails.

Results: 106 web unit tests and 23 contract tests passed. All 22 reader/
assessment browser checks passed, plus focused desktop/mobile one-question
checks. Screenshots were inspected for both layouts. Focused ESLint passed.

The later authenticated player inspection informed the question-layout and
unsure-response implementation while preserving existing grading and answer
review rules.

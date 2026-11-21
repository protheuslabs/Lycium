# Khan Academy: Curriculum And Assessment Clarity

Date: 2026-11-20. Second focused study after Coursera.

## Evidence And Limits

Directly inspected the signed-out
[trigonometry course map](https://www.khanacademy.org/math/trigonometry) and
[right-triangle ratio practice](https://www.khanacademy.org/math/trigonometry/trigonometry-right-triangles/xfefa5515:ratios-in-right-triangles/e/use-ratios-in-right-triangles).
Viewed the course map and desktop exercise, selected an incorrect answer and
checked it, then inspected the exercise at 390px phone width. Dismissed cookie,
donation, signup, and onboarding overlays to reach the actual learning UI. No
account, enrollment, paid feature, or authenticated progress was inspected.

The official [mastery documentation](https://support.khanacademy.org/hc/en-us/articles/115002552631-What-are-Course-and-Unit-Mastery)
describes performance-based skill states. That is a separate product capability,
not a different label for reading completion. Public screens and documentation
may differ across Classic/Reimagined experiences and experiments.

## Observations And Adaptations

| Area | Direct observation | Lycium adaptation |
| --- | --- | --- |
| Course map | Unit structure, activity icons, and a visible state legend make the course scannable. Quizzes and unit tests are distinguishable from individual skills. | Add per-module completed-section counts and slim progress bars. Use recognizable lesson/assessment and completed/viewed icons in the curriculum, with accessible state descriptions. |
| Navigation styling | A quiet, pale selected row and narrow accent rule identify the current activity. Lesson links are grouped in a persistent desktop outline. | Keep Lycium's current responsive outline and Coursera-derived overview, while making the curriculum a more legible connected list instead of introducing another navigation shell. |
| Practice task | One clearly framed task, understated answer rows, an explicit selection state, and a distinct checking action. | Preserve Lycium's full-attempt assessment format, but clarify single versus multiple selection, add answered-question progress, and use a recognizable bookmark for review marking. |
| Feedback | The incorrect response produced a short feedback popup, retry action, and access to hints/steps. | Add a clear submitted-result band with score and passing threshold. Add question-level correct/incorrect text and icons only when the existing answer-reveal policy permits it. Do not invent explanations or hints. |
| Mobile | The full outline is removed from the main task viewport. A compact task footer keeps the practice action near the problem. The inspected table required horizontal room. | Retain Lycium's mobile outline dialog. Keep assessment actions in the document flow because Lycium currently displays full assessments rather than one task at a time; do not pin a second toolbar over long content. Check 320px reflow instead of copying overflow. |
| Learning signals | Course mastery, streaks, levels, and skill indicators are prominent. | Use only existing section completion/viewing and quiz scores. No mastery map, streak, XP, or adaptive recommendation is fabricated. |

## Implemented Boundaries

- `CourseCurriculum` displays completion from the existing resolved course-scoped
  statuses. Merely opening the overview must not start a course or change progress.
- `QuizAttemptFeedback` presents the selected attempt, including historical
  review. A quiz with no passing threshold says submitted, not passed.
- `QuizBlock` derives an answered-question count from persisted selections. It
  does not change question order, grading, time limits, retry limits, storage keys,
  automatic submission, or course completion rules.
- Per-question results and answer indicators obey the existing reveal policy.
  This remains an assessment, not a new per-question retry/practice engine.
- Historical attempt rows now support Enter/Space as well as pointer input.
- Unknown passing requirements and unlimited time/attempts use readable labels
  rather than misleading infinity shorthand.
- No curriculum-generation prompts, source handling, real course data, or paused
  library assets were changed by this study.

## Deferred Ideas

Actual skill mastery, related-lesson recommendations, a separate practice mode,
worked hints, and adaptive remediation need explicit content/data contracts and
learning rules. They are not silently added as cosmetic UI states. The public
donation/onboarding campaigns, child/classroom flows, and third-party sharing
controls are not adopted.

## Verification

Use isolated browser fixtures for completed/viewed/locked/untouched sections,
module progress, answer selection and reload, grading, hidden/revealed answers,
multiple-selection questions, retries, historical-attempt keyboard review,
light/dark, and 320/390/768/1280px layouts. Preserve the existing reader, editing,
navigation, and course-scoped quiz-persistence checks. Inspect screenshots rather
than treating an overflow assertion as sufficient visual review.

Results: 102 unit tests passed. The broader 70-case desktop/mobile run passed
68 checks and caught two curriculum jump-link failures. After scoping overview
navigation to its scroll pane, all 40 learner/feedback checks passed on rerun,
including the two regressions and hash-link reload. Reader, editing, accessibility,
and mocked file-generation checks passed in the broader run. TypeScript, focused
ESLint, import/data guards, and the production build passed. Screenshots were
inspected in light/dark on phones and desktop; a real course overview was also
checked in the in-app browser without starting lessons or changing completion.

The screenshot review also exposed hardcoded dark-mode answer text colors;
revealed answers now inherit semantic text colors, with a computed-color regression
assertion. This is not a teaching-quality evaluation or a full accessibility audit.

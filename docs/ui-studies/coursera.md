# Coursera: Discovery And Course Fit

Date: 2026-11-20. Scope: public, signed-out discovery and course overview.
This is a design study, not a ranking of educational effectiveness.

## Direct Inspection

Inspected [statistics search](https://www.coursera.org/search?query=statistics)
and the University of Amsterdam's
[Basic Statistics overview](https://www.coursera.org/learn/basic-statistics).
Opened a search result, inspected desktop screenshots, expanded the Exploring
Data module, and inspected the course overview and search at 390px phone width.
No account, enrollment, payment, or learner-player access was attempted.
Public interfaces may vary by locale, account, and experiment.

## Observed Styling And Behavior

| Area | Observation | Lycium decision |
| --- | --- | --- |
| Desktop search | Three substantial image-led cards across the observed viewport. Provider, title, skills, and concise facts have distinct typographic levels. Quiet borders, little elevation. | Increase minimum catalog card width. Keep Lycium's existing subject artwork and neutral/emerald identity; avoid decorative shadows. |
| Phone search | Cards become compact horizontal results, with a small image beside text rather than a large cover above every result. Search and filters stay near the results. | Use horizontal catalog cards below 560px. Preserve an independent info button, selection, progress, prerequisite, and retry behavior. Home shelves remain image-led. |
| Course identity | A full-width tinted band establishes the course title and primary action. The title is not buried inside a floating card. | Replace the split overview composition with an unframed identity band, compact subject cover, readable description, and clear Start/Resume action. |
| Course facts | Module count, level, schedule/workload, and assessments are individually scannable rather than mixed into prose. | Separate real curriculum counts, level, estimated effort, and assessment counts into a definition-list strip. Omit missing facts; do not manufacture a schedule or estimate. |
| Page navigation | About/Outcomes/Modules and other local jump links remain available deeper in the desktop page. | Add a sticky, horizontally scrollable local navigation bar. Only link to sections that exist. Keep one primary Start/Resume action. |
| Learning scope | Skills/outcomes are visibly separated from marketing and module listings. | Surface explicitly authored course-template learning outcomes and existing topic labels. Never turn private planning descriptions into student-facing lesson content. |
| Curriculum | Expanding a module reveals its description and content-type counts, with deeper content hidden until requested. | Keep native module disclosures, add Expand/Collapse all and section-format labels. Preserve ordering locks and direct lesson navigation. Do not expose private module planning prose. |
| Phone detail | Facts stack under the entry band; the main action is full-width. The inspected module titles were heavily truncated. | Reflow facts and outcomes without clipping; keep complete module names. Do not copy the truncation or the upsell-heavy content. |

## Deliberately Not Copied

- Ratings, learner counts, instructors, certificates, or institutional logos:
  Lycium does not have corresponding verified data.
- Pricing banners, enrollment urgency, sales shelves, and an unsolicited AI chat.
- Blue branding, pill-heavy filters, and large marketplace navigation structures.
- A mandatory signup step before browsing or local learning.
- A fabricated beginner/no-prerequisites default for incomplete metadata.

## Implementation Boundaries

`utils/coursePresentation.ts` reads explicit course-template outcomes, existing
time estimates, and actual quiz/project blocks. It is presentation-only: no
generation prompts, contracts, or course files are changed. It omits malformed
or missing outcomes rather than deriving claims from titles. Assessment counts
describe included blocks, not their validity or difficulty. Unfilled Apply
sections are labeled as other assessments, not invented quizzes/projects.

`CourseOverview` owns the overview composition; `CourseCurriculum` owns local
disclosure state. The shared `CourseCard` retains its existing adapters and
actions, with a catalog-only narrow-screen layout. Shared tokens continue to own
surfaces and typography. The paused library scene is outside this increment.

## Verification

Use isolated browser fixtures, not live provider calls. Check phone/tablet/desktop,
light/dark, long titles, sticky navigation, disclosures, accurate effort/counts,
missing metadata, ordered locks, and progress not being created by browsing.
Retest existing resume, assessments, editing, URL/file generation, and info-button
behavior. Save screenshots as test artifacts, not bundled course artwork.

Next study: Khan Academy's curriculum-to-practice journey. Authentication-only
Coursera dashboards and learner-player behavior remain unreviewed.

Results: 102 web unit tests and 52 isolated desktop/mobile browser checks passed,
along with TypeScript, focused ESLint, import/data boundary guards, and a clean
production build. Screenshots were visually inspected, and an existing local
macroeconomics course was opened in the in-app browser. These are presentation
and interaction checks, not validation of the generated course's academic quality.

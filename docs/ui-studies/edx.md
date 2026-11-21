# edX: Course Fit, Progress, And Resume

Date: 2026-11-21. Fifth focused study after Coursera, Khan Academy, Udemy, and Canvas.

## Evidence And Limits

Directly inspected the public [edX discovery page](https://www.edx.org/search) and the public [CS50's Introduction to Programming with Python](https://www.edx.org/learn/python/harvard-university-cs50-s-introduction-to-programming-with-python) page. The course page exposes breadcrumbs, course identity, learning outcomes, effort, language, prerequisites, curriculum context, and enrollment actions. Also used the official [resume guidance](https://support.edx.org/hc/en-us/articles/360000396027-Return-to-where-you-were-working-in-a-course) and [course-home guidance](https://help.edx.org/edxlearner/s/article/Whats-the-Course-Homepage?language=en_US) identified in the research plan. No authenticated player, paid enrollment, or course run was accessed.

## Observations And Adaptations

| Area | Observation | Lycium adaptation |
| --- | --- | --- |
| Discovery | Cards distinguish courses from programs and expose useful level/effort facts. | Preserve the existing shared cards and publish-only discovery; omit unsupported credentials and enrollment facts. |
| Course context | The public course page uses breadcrumbs and a clear identity/description hierarchy. | Keep the existing return-aware overview action and Canvas-derived lesson breadcrumbs. |
| Learning outcomes | Outcomes are a direct, inspectable list rather than hidden planning data. | Retain the existing real course-template outcomes. |
| Prerequisites | Prerequisite information is visible alongside other course-fit facts. | When prerequisite metadata is explicitly an empty list, show `No prerequisites listed.` Keep missing metadata omitted rather than guessing. |
| Resume/progress | edX documents returning to the working location and distinguishes completion from grades. | Add an overview Progress area only for started courses, using real course-scoped section counts and the saved lesson. Resume uses the existing bookmark behavior. |
| Course runs | Public presentation includes dates, certificates, enrollment totals, and promotional material. | Do not import those concepts without corresponding Lycium capabilities. |

## Implemented Boundaries

- Started courses expose a `Progress` jump link and an unframed overview section with current completion, saved-lesson identity, and Resume/Review.
- Fresh courses do not show a zero-filled progress section merely because progress is technically zero.
- `prerequisites: []` produces an explicit empty-state fact; absent prerequisite metadata remains omitted.
- Existing section progress, assessment results, bookmarks, and storage contracts were not changed.

## Deferred Ideas

Course runs, verified certificates, grades, enrollment, language/transcript metadata, instructor profiles, and authenticated cross-device resume require real data and product decisions. They are not represented by decorative UI.

## Verification

Desktop/mobile checks cover the started-course progress area and jump link, saved-lesson identity, direct-link fallback, fresh-course omission, explicit empty prerequisites, light/dark overview presentation, and phone/desktop overflow. The existing whole-course resume and assessment behavior remains covered by learner/feedback suites.

Results: 104 unit tests passed. Six focused desktop/mobile checks passed for
progress/resume, fresh-course state, prerequisites, and course-fit regressions.
TypeScript, focused ESLint, and the production build passed. The real local
course overview was visually inspected with its saved-lesson progress area.

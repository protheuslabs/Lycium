# Udemy: Personal Course Library And Discovery

Date: 2026-11-21. Third focused study after Coursera and Khan Academy.

## Evidence And Limits

Directly inspected the signed-out [development catalog](https://www.udemy.com/courses/development/) at desktop width, including category navigation, sorting, grouped filters, course-result metadata, and an open course-preview popover. The preview exposed learning outcomes without changing the underlying result layout. Consulted the official [course-player documentation section](https://support.udemy.com/hc/en-us/sections/206457187-Course-player) for the documented player/tool boundary. No account, checkout, enrollment, or authenticated course player was used.

## Observations And Adaptations

| Area | Observation | Lycium adaptation |
| --- | --- | --- |
| Scanning | Results pair a substantial thumbnail with a compact hierarchy of title, description, and supporting facts. | Use two-column, landscape course items on desktop and a smaller image/content split on phones. Preserve readable titles, saved-lesson context, and real progress. |
| Library controls | Search, categories, sorting, and filters help people narrow a large collection. | Add course-count tabs for in progress, completed, and all courses; search titles/descriptions/subjects; filter only by actual subjects; sort by title or real completion. |
| Resume | The learner's existing course and current activity matter more than promotional discovery after starting. | Keep one prominent saved-lesson continuation area, then a separate organized course list. Existing bookmarks continue to determine the lesson opened. |
| Preview | The inspected hover preview reveals useful course outcomes without moving the result row. | Preserve Lycium's overview and outcome disclosure. Do not put essential content behind hover-only popovers or moving previews. |
| Visual styling | Dense metadata and strong thumbnail/result separation make repeated content easy to compare. | Keep Lycium's semantic colors, restrained borders, typography, and shared card anatomy rather than copying Udemy's marketplace palette or promotional shelves. |
| Header and controls | The inspected course page uses a white global header, near-black course identity band, pill search, and mostly square-corner actions. | Use a surface-colored topbar in both themes, a `#1C1D1F` course masthead, pill search fields, and 4px action controls while retaining emerald accents. |

## Implemented Boundaries

- My Learning retains the single `Continue learning` action and course-scoped saved progress.
- New tabs use accessible selected states, arrow/Home/End keyboard navigation, and a labeled result panel. Counts distinguish started, completed, and available courses; available does not mean enrolled.
- Subject choices are derived from the available courses. Sorting by completion uses current section completion, not invented recency or grades.
- No prices, ratings, instructors, carts, sales urgency, credentials, activity timestamps, or video assumptions were introduced.
- No course-generation, assessment, persistence, source-index, or paused library-scene code changed.

## Deferred Ideas

Recent-activity sorting needs trustworthy activity timestamps in the storage/API contract. Save-for-later, archived courses, notes, resources, and richer player tools need real capabilities before gaining UI. A separate creator workspace remains a higher-priority product boundary than marketplace expansion.

## Verification

Results: 104 unit tests passed, including actual subject/description filtering, all-course selection, progress sorting, and existing course isolation. All 34 desktop/mobile learner-page browser checks passed, including filtering, sorting, clear-filter recovery, tab keyboard behavior, saved-section resume, empty/dark states, and 320/390/768/1280px overflow and screenshot checks. TypeScript, focused ESLint, import/data/seed guards, and the production build passed. The real local My Learning page was also inspected in the in-app browser. This is not an authenticated Udemy player comparison or a full accessibility audit.

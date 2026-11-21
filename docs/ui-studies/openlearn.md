# OpenLearn: Catalog Comparison And Layout Choice

Date: 2026-11-21. Seventh focused study after Coursera, Khan Academy, Udemy, Canvas, edX, and MIT OpenCourseWare.

## Evidence And Limits

Directly inspected the public [OpenLearn full catalog](https://www.open.edu/openlearn/free-courses/full-catalogue), dismissing the cookie overlay to view the results UI. The page exposes subject, level, resource-length, language, and type filters; sorting; a real result count; Grid/List controls; course imagery; effort; and pagination. No account was created and no enrollment or badge flow was tested.

## Observations And Adaptations

| Area | Observation | Lycium adaptation |
| --- | --- | --- |
| Results | A visible result count helps learners understand the current result set. | Show the actual filtered course count, with singular/plural text and an accessible live update. |
| Layout | Grid and List controls support different comparison preferences. | Add icon buttons with pressed states and tooltips. List uses compact horizontal cards and retains the same course actions. |
| Filters | Subject, level, length, type, and language are grouped in a refinement area. | Preserve Lycium's existing real category/department/level/activity filters. Add no language, badge, popularity, or duration facets without dependable metadata. |
| Discovery access | Public content is browsable while profile benefits are separate. | Preserve publish-only public discovery and device-local My Learning without a signup wall. |
| Mobile | Dense persistent filters can compete with the result list. | Keep Lycium's compact filter panel and verify layout controls/results at phone widths. |

## Implemented Boundaries

- `CatalogToolbar` exposes Grid/List controls only for course results and displays the current filtered count.
- `CatalogCourseGrid` switches layout through a stable class; no course data or filtering logic changes.
- List cards retain their artwork, title, description where space permits, activity, prerequisites, and existing actions.
- Pagination and Studio workflows remain intact. Layout preference is session-local UI state; no fake account preference is claimed.

## Deferred Ideas

Duration ranges, language facets, badges, popularity sorting, and account-saved layout preferences need trustworthy metadata or hosted accounts. They are not inferred from course titles or generated presentation text.

Results: 104 unit tests passed. Ten focused desktop/mobile checks passed for
layout switching, result counts, phone overflow, filtering/sorting, keyboard
dialogs, shared cards, and site chrome. TypeScript, focused ESLint, and the
production build passed.

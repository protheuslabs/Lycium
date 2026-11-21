# Canvas: Course Workspace And Navigation

Date: 2026-11-21. Fourth focused study after Coursera, Khan Academy, and Udemy.

## Evidence And Limits

Inspected the official [Course Home Page guide](https://community.instructure.com/en/instructure/kb/articles/661274-how-do-i-use-the-course-home-page-as-a-student) and its full product screenshot, plus the [Course Navigation Menu guide](https://community.instructure.com/en/instructure/kb/articles/664370-how-do-i-use-the-course-navigation-menu-as-a-student). These expose the course-navigation column, active indicator, collapse control, breadcrumbs, content area, and course-specific sidebar without an account. No authenticated or public institution course was presented as a hands-on interaction test.

## Observations And Adaptations

| Area | Evidence | Lycium adaptation |
| --- | --- | --- |
| Global versus course navigation | Canvas separates the global course destination from links within the current course. | Retain the shared site header and a distinct course outline. The reader breadcrumb links the actual course overview rather than acting as static text. |
| Orientation | Breadcrumbs identify the course and content hierarchy above the working area. | Add a semantic `Course breadcrumb` navigation with course and module context before the section heading. |
| Current location | The active course-navigation item uses text color and a line indicator. | Use Lycium's softer active-section background, color, and weight without the side rule; add a subtle active-module surface. |
| Module progress | Canvas module requirements distinguish activities and completion. | Show real completed/total section counts per module using existing course-scoped statuses; do not infer mastery. |
| Collapse/mobile | Course navigation can collapse; a persistent rail is not necessary for every viewport. | Preserve the existing desktop collapse and keyboard-contained mobile outline drawer. |
| Course sidebar | Canvas can dedicate a separate column to due work and institutional activity. | Do not add another persistent column. Lycium has no due-date/calendar model and should prioritize reading width. |

## Implemented Boundaries

- `ReaderHeader` exposes semantic course/module breadcrumbs and a real overview link.
- `SidebarModuleHeader` receives counts derived from current resolved section statuses. No new progress storage or grading semantics were introduced.
- Existing lesson/assessment labels, prerequisite locks, citations, section navigation, editing, and course-scoped attempts remain unchanged.
- No due dates, grades, announcements, discussions, institution administration, or fabricated activity feeds were added.

## Verification

Run the full reader suite on desktop/mobile, including breadcrumb identity/link,
module counts, phone/tablet/desktop overflow, mobile drawer focus and dismissal,
section-scoped citations, assessment persistence, and course isolation. Also run
the manual-editing checks because the breadcrumb contains existing course/module
edit controls.

Results: 104 unit tests passed. Reader desktop/mobile checks passed, including
the second-course quiz-isolation regression. Manual title/block/source/quiz/
project editing checks passed; the module-editing assertion was updated for its
new completion text. TypeScript, focused ESLint, and the production build
passed. Screenshots were inspected at desktop and phone widths.

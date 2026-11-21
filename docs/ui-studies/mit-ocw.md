# MIT OpenCourseWare: Materials And Academic Content

Date: 2026-11-21. Sixth focused study after Coursera, Khan Academy, Udemy, Canvas, and edX.

## Evidence And Limits

Directly inspected the public [Classical Mechanics course](https://ocw.mit.edu/courses/8-01sc-classical-mechanics-fall-2016/), including its desktop presentation and course-material navigation. The page exposes course description, level, topics, learning resource types, an image with attribution, and direct destinations for syllabus, online textbook, readings, assignments, review, and weekly material. No authenticated experience is required for those public materials.

## Observations And Adaptations

| Area | Observation | Lycium adaptation |
| --- | --- | --- |
| Course-material navigation | Syllabus, readings, textbook, assignments, review, and weekly content are directly inspectable. | Expose attached course sources on the overview before starting, while preserving the module/section reader. |
| Resource types | Lecture videos and problem sets are identified as learning-resource types. | Derive lesson, review, quiz, and project counts from the actual section structure. Do not claim media types that are absent. |
| Attribution | Course identity, department, level, topics, and image attribution are visible. | Retain existing academic facts and show source title plus known author/publisher/type metadata. |
| Sources and readings | Substantial readings are course content, not a hidden generation manifest. | Add a Course materials section with external links where available and non-link labels for private/local sources. Preserve section-specific citation footers. |
| Download | MIT offers a course download under its publishing/license model. | Do not add a download action until packaging and source rights are supported. |

## Implemented Boundaries

- `CourseMaterials` lists attached/referenced sources and resolves central source records without treating them as section-level citations.
- `CourseOverview` derives lesson/review counts and conditionally exposes a Materials jump link.
- `CourseSourcesPage` links its course title back to the actual overview.
- Existing reader citations still show only sources used by the current section; assessment sections retain no source footer.
- No course download, instructor, institution, accreditation, or license claim was added.

## Verification

Desktop/mobile checks cover overview materials before starting, central and local source records, external-link safety, resource counts, the Materials anchor, and the Sources-to-overview link. The full reader suite covers existing outline, citations, assessments, theme, and course-isolation behavior.

Results: all 12 desktop/mobile reader checks and 104 unit tests passed.
TypeScript, focused ESLint, and the production build passed. The live overview
was also inspected for the derived instruction/resource facts.

# FutureLearn: Next Steps, Preview, And Progress

Date: 2026-11-21. Tenth and final study in the original review series.

## Evidence And Limits

Inspected the public [Foundations of Marketing course](https://www.futurelearn.com/courses/foundations-of-marketing-build-a-modern-marketing-plan) and its public [Competitive advantage lesson preview](https://www.futurelearn.com/info/courses/foundations-of-marketing-build-a-modern-marketing-plan/0/steps/302145). The course exposes duration/weekly effort, level, syllabus weeks, requirements, outcomes, and direct sample steps. The preview exposes actual lesson content, a video area, and return-to-course links. No account or private Progress dashboard was required for this pass.

The official [learner guide](https://futurelearn.zendesk.com/hc/en-us/articles/360012328320-How-to-start-a-course-on-FutureLearn) remains the reference for step types, next-step emphasis, completion, and mobile navigation.

## Observations And Adaptations

| Area | Observation | Lycium adaptation |
| --- | --- | --- |
| Preview | Visitors can inspect selected real steps before joining. | Preserve direct public lesson access through the curriculum. Lycium does not need a separate enrollment gate. |
| Next step | Learner guidance emphasizes clear step navigation and explicit completion. | Preserve Previous, Next, Mark complete, and saved-section resume independently of global navigation. |
| Progress | Progress is a course-local destination rather than global marketing content. | Add Progress beside Sources in the course outline, linking to the real overview progress section. |
| Activity types | Courses mix video, articles, audio, practical activities, and assessments. | Preserve the existing activity labels and render only supported content formats. |
| Social/paid structure | Comments, subscriptions, start dates, accreditation, and certificates have separate product requirements. | Do not add them as decorative or unsupported UI. |

## Implemented Boundaries

- The outline Progress link uses the actual course route and `#progress` target.
- It works in the desktop outline and closes the mobile drawer before navigation.
- The overview retains its real course-scoped completion and saved lesson data.
- No duplicate progress store, due dates, social activity, certificate threshold, or enrollment state was introduced.

## Verification

Desktop/mobile checks cover the outline-to-Progress flow, hash target, real progress heading, and restored global overview header. Existing reader tests preserve public lesson access, next/previous/completion behavior, citations, assessments, and course isolation.

Results: all 16 desktop/mobile reader checks and 107 web unit tests passed.
TypeScript and focused ESLint passed.

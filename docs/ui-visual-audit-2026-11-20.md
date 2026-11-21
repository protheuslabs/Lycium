# Learning Product Visual Direction

Date: 2026-11-20. Supplements [the UI overhaul plan](ui-overhaul-plan.md).

## What Was Actually Inspected

This round examined styling and composition, not only feature documentation. Public pages and official screenshots were opened in a browser. No enrolled or paid account was used. Screenshots in help articles are evidence of the illustrated experience, not proof of every current product variant. No accessibility or educational-effectiveness ranking is implied.

| Reference | Evidence | Visual observations | Decision for Lycium |
| --- | --- | --- | --- |
| [Khan learner home](https://support.khanacademy.org/hc/en-us/articles/115003342971-How-do-I-edit-the-My-Courses-section-on-my-Home-page) | Official guide; learner-home screenshot opened at full size | Course columns lead into unit sequences. A Resume action sits beside the relevant unit. The illustrated screen does not lead with aggregate course statistics. | Put a real lesson and Continue action first. Do not present activity as mastery. |
| [Canvas course dashboard](https://community.instructure.com/en/kb/articles/662815-unknown) | Official guide; illustrated Courses tab screenshot opened | Course imagery, compact identity, and course-specific tools; global navigation stays separate. Four compact cards fit across the illustrated desktop view. | Give courses recognizable covers. Keep course controls independent from the card's main action. Do not invent assignment deadlines. |
| [edX learner entry](https://support.edx.org/hc/en-us/articles/360038194614-How-do-I-start-my-course) | Official guide; course-entry screenshot opened | Wide course row with a thumbnail, prominent title, quiet metadata, and one Begin Course action. This is a row example, not a full dashboard audit. | Distinguish inspecting a course from resuming a lesson. Use concise course-level progress. |
| [Codecademy catalog](https://www.codecademy.com/catalog/all) | Live public desktop page | Strong typographic hierarchy and illustrated subject cards; large search/assistant area; a conventional filter column below. A promotional modal appeared while scrolling. | Borrow deliberate subject identity and clear discovery hierarchy, not the cream/navy palette, promotional interruptions, or an assistant we have not built. |
| [Codecademy dashboard](https://help.codecademy.com/hc/en-us/articles/1260801844089-Updates-to-your-Dashboard) | Documentation only | Documents a resume destination, personal learning lists, and recommendations. No signed-in dashboard was visually inspected. | Separate the immediate continuation task from the broader personal course collection. |
| [Coursera course detail](https://www.coursera.org/learn/learning-how-to-learn) | Live public desktop page | Large course title and enrollment action, distinct workload facts, skills, and curriculum. Promotions and an assistant panel competed with the course. | Add a real course overview with scope and expandable curriculum. Avoid marketplace persuasion, fabricated reviews, and unsupported chat. |
| [Brilliant](https://brilliant.org/) | Live public desktop page | Large, confident typography, a simple primary decision, and visible product/learning examples rather than a directory of links. The current page promotes its tutor experience. | Make learning objects and clear actions visible. Do not imply Lycium has that tutor or its accreditation. |
| [Udemy lists guide](https://support.udemy.com/hc/en-us/articles/230381388-Organizing-Your-Udemy-Courses-With-Lists) | Old guide redirected to the new help-center landing page | The requested dashboard/list screenshot was not available at that URL. Earlier public catalog observations remain in the main plan. | No claim that the current signed-in My Learning styling was inspected. |

## Diagnosis Of The Previous Pass

- The stock library photograph implied an archive rather than an active learning environment.
- Text-only cards with a thin colored rule did little to distinguish subject matter.
- The dashboard spent its prime space on totals and motivational copy rather than a specific learning action.
- Home, catalog, and reader had functional improvements, but insufficient visual identity connecting them.
- Heavy pill controls and duplicate progress in the reader made the interface look assembled from unrelated pieces.

## Chosen Direction

Two directions were considered: an academic directory with dense text rows, or a contemporary learning product with image-led discovery and a restrained study workspace. Choose the latter. Density remains useful inside curriculum and settings, but must not define the entire site.

Use a black navigation bar, white/neutral reading surfaces, an emerald action accent, and distinct cobalt/coral/mint subject imagery. Avoid a one-hue theme. Keep interface headings compact, reserve large typography for home and course identity, use 6px controls and 8px course covers/cards, and keep spacing consistent. No hover movement or layout shifts.

### Page Roles

- **Home:** full-bleed subject still life, visible Lycium identity, discovery and My Learning destinations, then actual course choices. Show continuation only when real saved activity exists.
- **My Learning:** Continue learning with the saved lesson and course-specific progress; then searchable active/completed courses. No KPI strip, fake study streaks, arbitrary goals, grades, or deadlines.
- **Catalog:** recognizable course covers, readable subject labels rather than taxonomy slugs, concise descriptions, existing search/filter/create controls, and preserved generation/retry states.
- **Course overview:** description, available workload/level facts, prerequisites, expandable curriculum, Start/Resume. Viewing the overview must not create learning activity. Curriculum ordering must preserve existing locks.
- **Reader:** lesson-first hierarchy, generous reading width, quiet controls, existing responsive outline. Progress stays in the outline instead of repeating under the lesson title.
- **Settings/dialogs:** share control sizing, focus rules, typography, and semantic surfaces. Authentication remains explicitly unavailable until actually implemented.

## Assets And Honesty

Generated editorial covers are category illustrations, not photographs of a real institution, scientific instruction, or evidence that a course contains interactive tools. Keep them decorative with empty alt text; the adjacent title and subject communicate identity. Asset prompts and provenance live beside the images. Future authored course artwork can replace these category fallbacks without changing generation prompts.

## Verification

Use isolated API fixtures for browser tests. Test 320/390/768/1280/1440 widths, light/dark, asset loading, long titles, overview without progress mutation, ordered curriculum, saved-section resume, assessment persistence, and editing. Inspect screenshots before declaring visual completion. Preserve existing generation jobs and provider settings; visual tests must never call real generation providers.

Still outside this visual increment: real authentication, enrollment/account sync, Studio separation, full program-page redesign, a screen-reader audit, and user studies. This is not a public-launch readiness claim.

## Shared Learner Presentation

The consolidation pass uses `components/CourseCard/CourseCard.tsx` and
`courseCard.css` as the single presentation owner for Home, My Learning, and
Catalog course tiles. `CourseProgress.tsx` owns section-completion display,
including Continue learning. Page adapters retain navigation, prerequisite,
selection, lifecycle, and progress behavior; the shared tile does not fetch or
mutate course data. Legacy card classes remain as integration/test hooks, not
separate visual systems.

Shared dimensions, typography, surfaces, and accent colors live in
`styles/tokens.css`. Superseded course/program card selectors were removed from
the catalog's baseline and theme layers rather than overridden again. Program
catalog diagnostics remain available in a native, keyboard-accessible
Authoring details disclosure. This is not a separate Studio workspace yet.

The navigation wordmark is now uppercase LYCIUM, with the existing mobile L.
The library scene remains paused and is not part of this main-site increment.
Keep the existing subject artwork and learner-first page roles. Next product
work should validate one complete flagship learning journey before adding more
dashboard widgets or undertaking another visual redesign.

Verification for this increment: 98 web unit tests, 50 focused desktop/mobile
browser checks (learner pages, reader, manual editing, mocked URL/file generation,
and prerequisite actions), TypeScript, focused component ESLint, import/data
boundary guards, and the production build passed. New assertions compare actual
computed card presentation between the three pages and check independent info
and authoring-disclosure actions. Screenshots cover light/dark and responsive
layouts; the local browser was also inspected with existing learner data. No
live generation provider was invoked. These checks do not establish curriculum
quality, full accessibility conformance, or public-launch readiness.

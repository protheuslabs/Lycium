# UI Research And Overhaul Plan

Research date: 2026-11-18. Latest visual checkpoint: 2026-11-20. Status: image-led discovery, lesson-focused My Learning, a distinct course overview, and shared reader/program styling are implemented; hosted learning and creator-workspace work remain open. See the [hands-on visual audit](ui-visual-audit-2026-11-20.md) and [artwork direction](course-artwork-style.md).

The institutional black/emerald palette and typography/application boundaries are recorded in the [visual identity contract](visual-identity.md). Future Tools, Presentation Studio, textbook, library, and tutoring surfaces are explicitly deferred until their real capabilities exist.

The dedicated lesson toolbar and reversible Focus Mode are defined in [reader focus](reader-focus.md).

Catalog discovery now includes only published courses. The `/studio` route retains drafts, generation status, review, and creation workflows. My Learning's All view contains active and completed learning, not unstarted catalog inventory. `/tools` is a real destination with an honestly marked in-development Graphing Studio entry, not a fake launch action.

## Contents

Focused site-by-site studies: [Coursera discovery and course fit](ui-studies/coursera.md).
Second study: [Khan Academy curriculum and assessment clarity](ui-studies/khan-academy.md).
Third study: [Udemy personal course library and discovery](ui-studies/udemy.md).
Fourth study: [Canvas course workspace and navigation](ui-studies/canvas.md).
Fifth study: [edX course fit, progress, and resume](ui-studies/edx.md).
Sixth study: [MIT OpenCourseWare materials and academic content](ui-studies/mit-ocw.md).
Seventh study: [OpenLearn catalog comparison and layout choice](ui-studies/openlearn.md).
Eighth study: [Brilliant active practice without gamification](ui-studies/brilliant.md).
Shared chrome: [site navigation and footer](ui-studies/site-navigation.md).

1. [Direction and research limits](#1-direction)
2. [Platform comparison](#2-platform-comparison)
3. [Product structure and navigation](#3-product-structure-and-navigation)
4. [Page specifications](#4-page-specifications)
5. [Shared UI inventory](#5-shared-ui-inventory)
6. [Visual and accessibility rules](#6-visual-and-accessibility-rules)
7. [State and data boundaries](#7-state-and-data-boundaries)
8. [Optional add-ins](#8-optional-add-ins)
9. [Implementation plan](#9-implementation-plan)
10. [Verification and decision gates](#10-verification-and-decision-gates)

## 1. Direction

Make Lycium a place to find a worthwhile course, understand its scope, study without distraction, practice, and return to saved work. Keep course creation and maintenance available in a distinct workspace rather than making every learner operate an AI tool.

Recommended combination: academic transparency, direct resume actions, a readable lesson workspace, and explicit assessment feedback. Do not reproduce an entire marketplace or institutional LMS.

This plan complements the [product principles](product-principles.md), [hosted MVP requirements](hosted-mvp-requirements.md), [teaching quality criteria](course-generation-quality-acceptance.md), and [design-token decision](adr/0007-centralize-design-tokens.md). Better presentation does not establish that a generated course is accurate, reviewed, accredited, or equivalent to college credit.

### Research Method And Limits

- Reviewed ten platforms through public home, catalog, and course pages and official learner documentation. Sources are linked beside observations below.
- Visually inspected six public interfaces in the browser: Khan Academy home/course, Udemy category catalog, Coursera course detail, MIT OpenCourseWare course detail, OpenLearn catalog, and Brilliant home.
- Authenticated dashboards, enrolled-course players, assignment submissions, and paid features were not tested with accounts. Those findings are documentation-based, not claims of a completed usability test.
- Some official help content was available through indexed extracts while its direct renderer failed, notably Udemy and Coursera support. Treat these as documented references and recheck before copying exact interactions.
- Public pages vary with device, locale, account, campaigns, and experiments. Udemy explicitly documents a pilot experience; Khan documentation spans Classic/Reimagined experiences; Brilliant is changing curriculum terminology. Borrow principles, not supposedly universal screenshots.
- The recommendations below are design judgments to validate with learners. Repeated patterns are not proof of superior learning outcomes. No conversion, completion, accessibility, or educational-effectiveness ranking was measured.

### Lycium Baseline

The current narrow-screen inspection found clipped catalog controls, description-heavy course tiles, a persistent lesson rail that reduces reading width, and notices/module headings that precede most of the instruction. Settings primarily exposes provider configuration. These are observations from that view, not a full desktop or accessibility audit.

Existing foundations worth preserving include course deep links, module/section structure, saved progress and bookmarks, scoped assessment attempts, source references, generation status/retry, editing, and light/dark/auto themes. Their existence does not mean hosted account isolation or cross-device persistence is complete.

## 2. Platform Comparison

Each row separates observed/documented behavior from a proposed Lycium adaptation. "Avoid" means a poor fit for our initial scope, not a claim that the other product is defective.

| Platform | Evidence and useful pattern | Proposed adaptation | Avoid importing by default |
| --- | --- | --- | --- |
| Khan Academy | Its public [trigonometry outline](https://en.khanacademy.org/math/trigonometry) exposes units, skills, quizzes, and a course challenge. The [learner-home guide](https://support.khanacademy.org/hc/en-us/articles/360030629852-What-is-my-Learner-Home-page-and-what-can-I-do-there) separates personal courses and class work. [Mastery documentation](https://support.khanacademy.org/hc/en-us/articles/115002552631-What-are-Course-and-Unit-Mastery) ties skill states to assessment performance. | Make the course map understandable and show a useful next action. Keep completion distinct from evidence of understanding. | School/family onboarding for every independent adult learner; a detailed mastery map without valid skill-level evidence. |
| Udemy | The [development catalog](https://www.udemy.com/courses/development/) makes search, categories, course identity, instructor, and rating information prominent. Its documented [player experience](https://support.udemy.com/hc/en-us/sections/206457187-Course-player) separates curriculum, resources, and personal learning tools; the [new experience is a pilot](https://support.udemy.com/hc/en-us/articles/34345830524183-Udemy-s-new-course-experience-Frequently-asked-questions), not universal. | Use a consistent listing hierarchy, a clear learner/creator boundary, and contextual resources rather than global clutter. | Carts, discount urgency, excessive promotional shelves, or a player that assumes every lesson is a video. |
| Coursera | Its [catalog](https://www.coursera.org/browse) distinguishes course and program types. A public [course detail](https://www.coursera.org/learn/learning-how-to-learn) presents level, workload, provider, modules, and assessment information. The [assignment guide](https://www.coursera.support/s/article/learner-000001563?language=en_US) documents practice versus graded work and pre-start timing information. | Give courses a substantive overview; let learners judge fit and workload before starting. Make assessment rules visible before an attempt. | Credential-led sales structure, unsupported institutional affiliations, or a mandatory promotional/chat panel beside course content. |
| Canvas | The official [dashboard guide](https://community.instructure.com/en/en/kb/articles/664620-how-do-i-use-the-dashboard) documents course-card, agenda, and activity views. [Global navigation](https://community.instructure.com/en/kb/articles/662861-how-do-i-use-the-global-navigation-menu) is separate from [course navigation](https://community.instructure.com/en/instructure/kb/articles/661274-how-do-i-use-the-course-home-page-as-a-student). [Module requirements](https://community.instructure.com/en/instructure/kb/articles/660912-how-do-i-use-modules-to-view-the-progress-of-students-in-a-course) distinguish viewing, submitting, and achieving scores. | Separate cross-course navigation from course-local navigation. Show actionable work and explicit prerequisite/completion rules. | An institution administration suite, multiple persistent navigation columns on mobile, or fabricated due dates for self-paced courses. |
| edX | The public [discovery page](https://www.edx.org/search) distinguishes subjects and offering types. Official guides document an [expandable course outline](https://help.edx.org/edxlearner/s/article/Whats-the-Course-Homepage?language=en_US), [resume actions](https://support.edx.org/hc/en-us/articles/360000396027-Return-to-where-you-were-working-in-a-course), and [completion separate from grades](https://help.edx.org/edxlearner/s/article/How-can-my-course-be-marked-as-completed?language=en_US). | Keep overview, resume, and assessment results separate but connected. Explain what each progress indicator actually measures. | Confusing viewing/completion with passing; paid-track and course-run complexity when Lycium has no corresponding product requirement. |
| MIT OpenCourseWare | The public [Classical Mechanics course](https://ocw.mit.edu/courses/8-01sc-classical-mechanics-fall-2016/) provides syllabus, readings, textbook, assignments, weekly materials, instructor/level information, and a course download. This is a materials library, not evidence of a personalized learner dashboard. | Make scope, prerequisites, materials, attribution, and assessments inspectable. Let substantial academic material remain substantial. | Treating a collection of documents as a complete guided learning experience; promising downloadable source material without checking rights. |
| OpenLearn | Its [catalog](https://www.open.edu/openlearn/free-courses/full-catalogue) exposes subject, level, duration, and language filters plus grid/list presentation. Its [enrollment benefits](https://www.open.edu/openlearn/free-courses/advantages-signing-on-free-course) explain progress tracking and recognition. | Make free discovery clear and filter by meaningful effort/level. Explain the benefit of saving learning without blocking public browsing. | Large institutional header structures or badge systems before course quality and progress semantics are reliable. |
| Brilliant | Current [public presentation](https://brilliant.org/) emphasizes visual interaction and a tutor. Its [learning-path guide](https://brilliant.org/help/features/what-are-learning-paths/) describes sequenced topics, explanations, hands-on problems, and checkpoints. | Put active understanding checks near instruction and make sequence visible. Offer help in context when a supported help system exists. | Turning all subjects into tiny gamified screens or making an AI tutor, XP, and leagues prerequisites for the reader overhaul. |
| Codecademy | Its [subject catalog](https://www.codecademy.com/catalog/language/python) exposes level, offering type, duration, and search. The documented [dashboard](https://help.codecademy.com/hc/en-us/articles/1260801844089-Updates-to-your-Dashboard) prioritizes resuming recent work; its [learning environment](https://help.codecademy.com/hc/en-us/articles/1260803449210-Updates-to-our-Learning-Environment) keeps course navigation and contextual tools near the exercise. | Lead the personal home with resume. Group help, reporting, and exercise controls around the current activity. | Applying a three-pane coding IDE to reading courses, or drawing a fake Run button without a safe execution service. |
| FutureLearn | A public [course page](https://www.futurelearn.com/courses/foundations-of-marketing-build-a-modern-marketing-plan) shows workload, syllabus, audience, and outcomes. Its [learner guide](https://futurelearn.zendesk.com/hc/en-us/articles/360012328320-How-to-start-a-course-on-FutureLearn) documents step types, next-step emphasis, completion, mobile navigation, and conversations/progress areas. | Make the next step unmistakable and keep previous/next/completion behavior consistent. Label lesson versus assessment activities. | Forcing every course into weeks, time-gating self-paced content, or adding discussions before moderation and support exist. |

### Cross-Platform Conclusions

1. **Discovery, personal learning, and studying are different tasks.** Public catalogs and course-detail pages answer "Is this for me?"; documented learner homes answer "Where do I continue?" See [Coursera course detail](https://www.coursera.org/learn/learning-how-to-learn), [edX resume](https://support.edx.org/hc/en-us/articles/360000396027-Return-to-where-you-were-working-in-a-course), and [Codecademy dashboard](https://help.codecademy.com/hc/en-us/articles/1260801844089-Updates-to-your-Dashboard).
2. **An outline is part of the product, not hidden generation metadata.** Show the actual curriculum, while keeping planning descriptions and internal handoffs private. Compare [Khan's units](https://en.khanacademy.org/math/trigonometry) and [MIT's material navigation](https://ocw.mit.edu/courses/8-01sc-classical-mechanics-fall-2016/).
3. **Activity is not mastery.** A completed reading and a passed assessment need different labels. [Khan's performance-based skill states](https://support.khanacademy.org/hc/en-us/articles/115002552631-What-are-Course-and-Unit-Mastery) and [edX's completion/grade distinction](https://help.edx.org/edxlearner/s/article/How-can-my-course-be-marked-as-completed?language=en_US) make this explicit.
4. **Contextual tools should support the task without replacing it.** Put source inspection, reporting, and later notes/help near the lesson, but make them user-opened. [Codecademy's environment guide](https://help.codecademy.com/hc/en-us/articles/1260803449210-Updates-to-our-Learning-Environment) and [Udemy's pilot guide](https://support.udemy.com/hc/en-us/articles/34345830524183-Udemy-s-new-course-experience-Frequently-asked-questions) illustrate different tool arrangements, not one arrangement to copy.
5. **Borrow the useful behavior, not the business model.** Promotion, credentials, teacher administration, and gamification have different purposes. Lycium should justify each against its own learner needs rather than equate prominence on another site with launch priority.

## 3. Product Structure And Navigation

### Audiences

| Audience | Primary task | Default destination | Must not have to do |
| --- | --- | --- | --- |
| Visitor | Find a credible course and inspect its fit | Public home or a deep-linked course | Configure a model or create an account just to browse |
| Returning learner | Continue learning and see unfinished work | My Learning | Search the public catalog again to resume |
| Creator/reviewer | Create, inspect, repair, and publish courses | Studio | Use learner pages as the only job-monitoring or editing interface |

Use **My Learning as the dashboard**, not separate Dashboard and My Learning destinations at launch. It can contain a compact overview and a course list on the same page. Do not add top-level grades, projects, calendar, community, and notes destinations until enough real functionality warrants them.

Proposed desktop global navigation: brand/home, Catalog, My Learning, creator-authorized Studio, and account/settings. Keep page search and filters in the page toolbar if the header cannot comfortably contain them. The lesson shell replaces catalog tooling with course context and an outline control.

On mobile: icon-only brand, a small menu, and the current context. Catalog search gets its own full-width row. Course outline becomes an overlay drawer rather than a persistent numbered rail. Do not try to compress every desktop control into one header row.

### Route Plan

Paths below omit the deployment prefix, currently `/Lycium`. They describe proposed destinations, not a required router replacement. Preserve existing section links, catalog/program links, browser back behavior, and static/local runtime support.

| Destination | Proposed route or existing surface | Initial scope |
| --- | --- | --- |
| Public home | `/` | Distinct compact home with real course discovery and a saved-course resume action |
| Catalog and subject results | Existing `/catalog`, `/catalog/courses`, `/catalog/programs`; query parameters for search/filter/sort/page | Reuse routes; do not add a parallel search application |
| Personal dashboard | Proposed `/my-learning` | Resume, active/completed courses, pending work supported by data |
| Course overview | Existing `/courses/[courseSlug]` | Give this route a distinct overview role rather than relying only on the current reader shell |
| Lesson/assessment | Existing `/courses/[courseSlug]/units/[unitSlug]` | Retain stable links and assessment identity |
| Program and group detail | Existing `/programs/[programSlug]` and catalog group routes | Preserve requirements and prerequisites; no new top-level "Clusters" menu |
| Course results and sources | Course-local Progress/Results and Sources destinations | Choose route versus panel during prototyping; neither needs global navigation |
| Studio and generation run | Proposed `/studio`, `/studio/runs/[jobId]` | Group current creation, job, review, and edit capabilities |
| Settings/account/help | Existing `/settings`; proposed account/help routes only as features exist | General preferences separated from authorized provider/admin configuration |
| Authentication/legal | Hosted sign-in/return flow and existing legal routes | Real auth integration, not a presentational account mockup |

Authentication-dependent routing must wait for a real authenticated runtime. Local mode can offer My Learning backed by device-local progress, clearly labeled as such. Do not claim account sync, secure draft privacy, or cross-device persistence until the hosted requirements are satisfied.

## 4. Page Specifications

Sections 4.1-4.11 define the core redesign patterns, with account, program, and backend-dependent features conditional on genuine capability and content. Section 4.12 identifies common secondary pages that do not all belong in the first release. Optional add-ins are collected separately in Section 8.

### 4.1 Public Home / Landing

**Job:** Show what Lycium offers and let someone find usable courses immediately.

- Use `Lycium` as the main brand heading with a short literal description of the available learning. Lead with search, subject browsing, and a small reviewed-course selection.
- Keep the introduction compact. Actual courses should appear in the first viewport on desktop and mobile; avoid a full-screen promotional gate, carousel, or sign-up wall.
- Show only subjects and programs that have available content. A narrow, curated launch catalog should look intentional rather than padded with empty categories.
- Link to course overviews and a sample public lesson. Explain authorship/review through real attribution, not borrowed university logos or an invented trust score.
- When signed in, make My Learning directly accessible and optionally route the brand/home destination there. Preserve an explicit Catalog link.
- A separate About/Mission page can carry longer project context. It does not need to interrupt study navigation.

**Acceptance:** A new visitor can find a course and inspect a lesson without provider setup, misleading credential claims, or mandatory onboarding. Search and a path to real course content are visible immediately.

### 4.2 My Learning / Dashboard

**Job:** Answer "What should I do next?" using actual saved learning state.

Display order:

1. Most recently studied course with its current lesson and a direct Resume action.
2. Other active courses and program requirements, with concise progress and next activity.
3. Pending assessments or submitted work awaiting feedback, only when those states exist.
4. Completed courses and a secondary browse-catalog entry.

Use a single continuation area and an organized list rather than many floating statistics panels. Do not put generic recommendations, streaks, charts, or provider diagnostics above unfinished learning. Without enrollments, use started/bookmarked courses and label them accurately; do not invent an enrollment backend.

**Acceptance:** Resume reaches the saved section in one action. A first-time learner gets useful catalog choices, not zero-filled charts. Completion and assessment results remain understandable without opening every course.

### 4.3 Catalog / Search / Subject Pages

**Job:** Compare available offerings and narrow by fit.

- Default to published/reviewed public offerings in the hosted catalog. Existing local drafts remain accessible to their creator in Studio or an explicit personal-drafts view.
- Core controls: search, Courses/Programs tabs, subject and level filters, sort, result count, active filter removal, clear-all, and pagination. Add workload/language filters only where metadata is dependable.
- Hide empty facets; do not offer price, star-rating, format, or popularity filters without corresponding trustworthy data.
- Preserve query, filters, sort, page, and scroll position when returning from an overview. Encode shareable discovery state in the URL; reset pagination appropriately when filters change.
- Desktop may show a filter sidebar; mobile uses one filter drawer with Apply, Clear, and result feedback. Preserve unapplied filter selections until Apply/Cancel.
- Repeated course items show title, one short description, level, estimated workload when known, attribution/review state when supported, and Start/View course or Resume as appropriate. Move verbose module/lesson text into personal-learning items or the overview.
- Use relevant, licensed course imagery where available, not random stock thumbnails or invented provider badges. Missing artwork must retain the same layout and not block discovery.
- Use one clear title/overview link and separate secondary controls. Do not nest buttons inside a clickable button/card. Hover must not move or realign content, reveal essential information only on hover, or change card size.
- An in-progress generation stays visible to its owner with `New Course` until a real title exists, a main workflow/module/section message, and indeterminate progress unless real work units justify a percentage. It is not an openable completed course.
- On failure, retain the tile/run and saved request. Offer the supported corrective action and retry; never send the user back to a blank creation form.

**Acceptance:** Filtering works with keyboard/touch, back restores discovery context, long titles remain identifiable, and no-results, loading, network-error, draft, queued, generating, and failed states are visually distinct.

### 4.4 Course Overview

**Job:** Make course fit and commitment clear before entering a lesson.

- First screen: course title, concise description, level/audience, workload estimate if available, prerequisite summary, and one prominent Start or Resume action.
- Follow with learner-facing outcomes, a real module/section outline, assessment/project expectations, required tools/materials, and authorship/review information.
- Expand modules to reveal actual sections, activity types, available time estimates, and progress. Do not expose hidden section-planning descriptions as lesson content.
- Keep the title/overview link separate from Resume: choosing to inspect a syllabus should not unexpectedly jump to a lesson.
- Course source inventory belongs in Sources. Do not display `Needs sources` in course titles or catalog badges; communicate section-level evidence limitations at the affected lessons. Course provenance/review details must not imply every section is verified.
- Offer creator-only edit/review actions separately. Unbuilt wrappers or missing program courses must not look like ready-to-study content.

**Acceptance:** A learner can determine suitability, inspect the outline, understand assessment expectations, and start or resume without an information modal being the only overview.

### 4.5 Program / Requirement-Group Detail

**Job:** Explain how multiple courses build toward a goal.

Present program purpose/outcomes, prerequisites, required versus elective groups, ordered courses, and current requirement satisfaction. Groups are curriculum organization, not another unexplained navigation mode. Distinguish satisfied, in-progress, available, and not-yet-available requirements. Recommend a next course only when dependencies and availability support it.

**Acceptance:** The learner can explain the next useful course and why it comes next. Missing courses, estimated workload, and non-accredited status are not obscured by polished program presentation.

### 4.6 Lesson Reader

**Job:** Teach the current section while keeping orientation and next steps accessible.

- Desktop: compact course context, collapsible course outline, constrained reading column, and optional user-opened source/help tools. A right panel is not permanently reserved for hypothetical AI features.
- Mobile: one reading column, outline drawer, compact module context, full section title, and navigation that fits without a permanent side rail.
- The section title is the primary page heading. Course and module are smaller context/breadcrumbs; do not repeat oversized course, module, and section headings.
- Keep the content width approximately 60-75 characters for prose, subject to testing with real content. Allow wider media or diagrams when needed; never make every paragraph a card.
- Render the available content formats consistently: text, headings, concepts, equations, worked examples, images, video/embeds, quizzes, and projects. The [format catalog](course-content-formats.md) remains the generation/renderer contract; new renderers are a separate decision.
- Keep equations and code-like content horizontally scrollable within their own region when necessary. Do not shrink them until unreadable or claim the existing equation block supports a new math engine.
- Use a compact, specific section-level source limitation notice when warranted, with details/action available on tap or keyboard. It must remain discoverable without dominating the whole first screen. Do not substitute a warning for instruction.
- Section references show only sources actually used there and keep stable course-wide citation numbering. Source details can open on demand; a course-wide source list is not the lesson footer. Assessment sections retain no source footer.
- Put Report issue and authorized edit/regenerate actions in secondary controls. Do not place Add source buttons on every block in the default learner view; preserve contribution through a deliberate action.
- Keep Previous, completion, and Next consistent. For a reading, consider one primary `Complete and continue` command with a secondary Next-only action. Existing assessment completion rules must still prevent unsupported completion.
- Keep the main lesson scroll, avoid mobile scroll traps, and preserve position when opening/closing tools. A sticky footer must not obscure content, focus, or the software keyboard.

**Acceptance:** A learner reaches substantive instruction promptly, can open the outline and return without losing position, inspect a citation, complete an allowed activity, and navigate by keyboard or touch.

### 4.7 Quiz / Test / Results

**Job:** Assess understanding fairly and make outcomes useful.

- Before starting, show scope, question count, time limit if any, pass criteria, attempt rules, and whether work is practice or a recorded assessment. Do not invent defaults in presentation that differ from the assessment spec.
- Use native radio semantics for single-answer questions and checkbox semantics for multiple-answer questions. Whole answer labels are selectable; selection, correctness, focus, and disabled states are distinct.
- Show current question/total and unanswered items. Choose all-questions versus paged presentation after testing long tests; keep the question model independent of that layout.
- Preserve selections, randomized ordering, timer/deadline state, and attempts through the existing storage/API boundary. Display saving, saved, reconnecting, and failed-save state truthfully.
- Navigation is not submission. Warn about unanswered questions when appropriate. Timed auto-submit and permitted review must follow the assessment contract, not client display conventions.
- Results show score, passing state, permitted explanations, missed concepts, relevant lesson links, and eligible retry. Do not expose answer keys before the allowed review point or leak another attempt's data.
- Use `passed`, `submitted`, and `completed` accurately; do not turn a quiz score into a course-wide mastery percentage without an accepted scoring model.

**Acceptance:** Two courses with overlapping quiz IDs never share answers; reload preserves the same attempt; keyboard-only completion works; feedback leads back to relevant material. Add two-account and course-version checks for the hosted release.

### 4.8 Projects / Submissions

**Job:** Explain the task, required evidence, and how it will be evaluated.

Show brief, deliverables, rubric, supported submission method, draft/submission state, and feedback. Preserve current project contract fields rather than adding every possible upload type. Distinguish draft, uploading, submitted, awaiting review, graded, and revision requested only where the backend supports those states. Label AI feedback as such; do not imply an instructor reviewed it.

**Acceptance:** A learner can understand the rubric before submitting, recover from a failed submission, revisit the submitted artifact, and distinguish successful submission from a passing evaluation.

### 4.9 Progress / Results / Sources

Keep these course-local, with a small number of tabs or links rather than a second application shell.

- **Progress/results:** section completion, assessment attempts/results, project state, and any genuinely supported requirement evidence. A timeline of opened pages is not proof of understanding.
- **Sources:** full course source catalog with title, author/publisher where known, source type, date/page reference when available, links, and used-in sections. Private-upload citations must not make private files public.
- **Completion:** a substantive end-of-course summary and useful next options. Certificates/badges are optional and cannot imply accreditation or mastery not demonstrated by the course.

### 4.10 Studio / Creation / Review

**Job:** Preserve the existing creation capabilities while removing them from the default learning surface.

- One creation entry supports prompt, sources/files, and optional scope settings. Keep provider details secondary and creator-authorized; the learner catalog does not require BYOK setup.
- An owner-visible run page/list contains saved request, queued/running state, specific current module/section, last update, cancellation when supported, artifacts, and retry using the same request.
- A failed provider displays a short actionable message. Raw error, job ID, and model diagnostics live in expandable details. Model errors are available on focus/tap as well as hover.
- Separate job completion, quality findings, publication, and learner progress. A generated draft does not automatically become a reviewed public course.
- Reuse outline/editor/review primitives. Make learner preview explicit and preserve section-scoped editing/regeneration. Publishing must not silently mutate the version a learner already studied.
- Do not require a new durable queue implementation just to restyle current job status. The hosted job guarantees remain separate backend prerequisites in the MVP requirements.

**Acceptance:** Creators can locate a failed course, inspect its stage, retry without re-entering prompt/uploads, edit a section, and preview the learner result. Unauthorized learners cannot reach credentials or private drafts through UI or direct APIs.

### 4.11 Account / Settings / Help / System Pages

- General settings: light/dark/auto, reading preferences when implemented, and supported accessibility controls. Put AI connections and diagnostics under an authorized creator/local-tools section.
- Hosted account flows: sign-in, sign-out, session expiry, return-to destination, privacy/data controls, and supported account recovery. Use the real authentication provider and server authorization; do not invent a separate OAuth system as part of styling.
- Help: course issue reporting and platform support are separate. Reports carry the relevant course version, section, block/assessment, and attempt context without silently sending credentials or private uploads.
- System pages: loading, offline/network failure, unavailable course, unauthorized/expired session, not found, and maintenance/retry. A failed catalog request must not masquerade as an empty catalog.
- Public footer: About, Help, accessibility contact, and existing legal pages. Keep the long discovery footer off the lesson canvas; make essential destinations reachable through a compact menu.

### 4.12 Common Secondary Pages: Scope Decisions

These are frequently useful page types, not claims that every researched platform implements the same version. Do not add a destination whose only content is "coming soon."

| Page or area | Lycium decision |
| --- | --- |
| Saved courses / bookmarks | Start as a My Learning filter or section, not another top-level app. Distinguish saving for later from starting or enrolling. Preserve progress when removing a saved item. |
| Creator / instructor profile | Conditional: real author attribution, bio, and published courses. Basic attribution on the overview comes first; public learner profiles remain opt-in. |
| Reviews / ratings | Optional: use existing feedback as supported; do not invent stars or convert generation quality reports into learner reviews. Public reviews need moderation and meaningful sample sizes. |
| Notifications / inbox | Conditional: add a small notification area only for real actionable events such as feedback or a completed run. No empty inbox or messaging system at launch. |
| Certificates / portfolio | Optional: meaningful records and artifacts first; no qualification claims beyond their evidence. Can initially live under completed learning. |
| Community / cohorts / discussions | Deferred until audience, moderation, privacy, and support responsibilities are defined. |
| Cart / checkout / subscriptions | Out of scope for the current free-learning launch; no empty marketplace machinery. |

## 5. Shared UI Inventory

Build a small shared vocabulary, not a generic component framework. Reuse existing primitives where behavior is sound. Every control needs default, focus, hover where relevant, pressed/selected, disabled, loading, and error behavior appropriate to its role.

| Element | Common contract | Responsive/state requirements |
| --- | --- | --- |
| App shell / topbar | Brand/home, a few destinations, visible current location | Compact mobile menu; no overflowing search/filter controls |
| Course shell / breadcrumbs | Course overview link, module context, outline control | Collapse context without hiding section identity; no permanent mobile rail |
| Tabs / local navigation | Switch coherent views; URLs for independently navigable pages | Keyboard behavior matches semantics; do not misuse tabs as arbitrary command buttons |
| Search field | Label, query, clear action, result feedback | Full-width mobile row; debounce/cancel safely; retain query |
| Filters / active filters | Labeled choices, count, remove, clear, Apply/Cancel in drawer | Focus management; disabled/empty options explained or omitted |
| Sort / select / combobox | Clearly identify selected value and available choices | Native select when sufficient; custom controls need accessible keyboard/typeahead behavior |
| Course / program item | Clear title link, short metadata hierarchy, one primary action | Predictable image/title/progress bands; grow for long titles; no layout shift on hover |
| Resume item | Course, saved section, completion, direct action | Different hierarchy from discovery; show accurate device/account persistence |
| Save / bookmark control | Named toggle with clear saved/unsaved state | Touch/keyboard access; removing from a list does not delete learning progress |
| Badge / metadata chip | Concise factual type/status, with explanation when necessary | No unsupported trust/credential claims or color-only meaning; do not make static metadata look clickable |
| Outline / accordion | Module expand/collapse, section links, activity/status icons | Current item and completion not color-only; drawer on small screens |
| Button / link / icon button | Links navigate; buttons act; icon tools have accessible names | Use shared Lucide icons if no existing library applies; tooltips on hover/focus; ample hit area |
| Overflow menu | Secondary edit/delete/report commands, separated destructive action | Above rows; dismiss on outside interaction, Escape, selection, and navigation; return focus appropriately |
| Tooltip / popover | Supplemental explanation, not the only path to important content | Important errors/details also open on tap/click; no hover-only functionality |
| Dialog / drawer | Focused task with title, close control, clear result | Trap focus only when modal; Escape/backdrop policy, focus restoration, viewport/keyboard-safe height |
| Forms / validation | Persistent labels, required/optional meaning, field-specific error | Preserve entered values and focus first invalid field; never rely on placeholder as label |
| File/source intake | Add/remove, upload/extraction state, validation feedback | Keyboard alternative to drop zone; retain artifact IDs across retry; disclose supported limits |
| Progress bar / status | State precisely what is measured | Indeterminate for unknown work; numeric labels for known values; no fabricated percentages |
| Save / connection status | Pending, acknowledged, offline/retrying, failed | Restrained live announcement; failure stays actionable; no false Saved state |
| Skeleton / spinner | Reserve layout for expected data | Distinguish initial load and background refresh; respect reduced motion |
| Empty / no-results / error | Different cause and corrective action | Search reset is not the remedy for a server failure |
| Notice / inline error / toast | Severity and action, concise human message | Blocking problems remain persistent; raw details expandable; no overlapping toast pile |
| Lesson headings / prose / lists | Semantic structure and readable rhythm | Long titles wrap; user text resizing works; no mandatory card around each block |
| Concept / equation / worked example | Consistent catalog-backed rendering and appropriate visual distinction | Local overflow for formal lines; concepts not inflated into full-screen tiles |
| Image / video / embed | Actual media, attribution, alternative text/captions where provided | Stable aspect ratio, missing-media fallback, no surprise autoplay; keep a source link when valid |
| Citation / source detail | Stable numbering, source metadata, link and return context | Touch/keyboard access; no course-wide source dump in every section |
| Quiz question / answer / navigator | Accessible selection, clear position, unanswered state | Preserve answer ordering/attempt scope; no accidental submission on navigation |
| Assessment result / feedback | Score, criteria, explanations when permitted, relevant next action | Correctness includes text/icon; do not communicate only red versus green |
| Project brief / rubric / submission | Deliverables, criteria, artifact, status and feedback | Readable stacked criteria on mobile; upload failure does not clear work |
| Table / data list | Real comparable rows with headers, actions, empty/loading states | Prefer stacked rows when practical; bounded table scrolling rather than page overflow |
| Pagination | Current page, result range, explicit previous/next | URL-backed state; stable controls; no forced infinite scrolling |
| Theme / preferences | Shared semantic tokens and persisted preference | System mode honored; all states readable in light and dark |
| Account / notification menu | Signed-in identity and supported account actions; actionable events only | Session-expiry state and unread meaning; no inaccessible hover-only account menu |
| Footer / support links | Compact trust/help/legal access | Do not turn every lesson into a marketing page |

## 6. Visual And Accessibility Rules

### Visual Direction To Prototype

- Quiet neutral light and dark surfaces, a restrained brand accent, distinct semantic success/warning/error colors, and real course/media assets. Avoid a page dominated by one hue, beige panels, decorative gradients, or stock classroom imagery standing in for course substance.
- Preserve the existing black topbar as the starting option; test it with both themes rather than making the entire app equally dark. Brand should be recognizable on home, with the compact `L` on mobile.
- Use consistent spacing, semantic type roles, and a small elevation hierarchy. Most page sections are unframed; cards are for repeated items, modals, or genuinely framed tools, not nested page containers.
- Start with approximately 16-18px reading text, comfortable line height, 60-75 character prose width, and compact contextual headings. These are prototype values to test, not measurements copied from competitors.
- Do not use viewport-width font sizing or negative letter spacing. Use wrapping and responsive layout instead of shrinking titles to illegibility. Keep ordinary card radii at or below 8px; define menu/control shape consistently through tokens.
- Use icons for familiar tools, text for substantive actions, and persistent labels where discoverability matters. Do not remove every label just to fit an overcrowded toolbar.
- Keep layout dimensions stable across loading, selection, and hover. Respect reduced motion and avoid unnecessary animation, auto-advancing shelves, or hover-dependent navigation.

### Accessibility Baseline

Target WCAG 2.2 AA and verify manually as well as automatically. These are independent requirements, not evidence that any researched competitor passes them.

- Reflow ordinary content at 320 CSS pixels; keep necessary two-dimensional media/table/formula overflow local. Support 200% text resize and test the 1280px/400% zoom case. See [W3C Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html).
- Meet text contrast requirements and visible non-text control/focus contrast in both themes; selected, error, completed, and current states need more than color. Use the [WCAG 2.2 criteria](https://www.w3.org/TR/WCAG22/) as the acceptance reference.
- Aim for 44px touch targets on primary mobile controls. This is Lycium's usability target, not the AA minimum: [SC 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) specifies 24 by 24 CSS pixels with exceptions including spacing.
- Ensure sticky headers, drawers, notifications, and footers do not obscure keyboard focus. See [Focus Not Obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum).
- Use semantic links, buttons, headings, lists, fieldsets, and native form controls. Add landmarks and skip links. Follow the relevant [APG patterns](https://www.w3.org/WAI/ARIA/apg/patterns/) for genuinely custom controls.
- Modal dialogs require suitable initial focus, contained keyboard navigation, Escape handling, inert background, and focus restoration. See the [W3C dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/). Important diagnostics cannot exist only in hover tooltips.
- Announce errors, saves, and meaningful generation changes without reading every polling update aloud. Test captions, alternative text, media failures, and timed-assessment accommodation requirements; do not rely on a polished shell to compensate for inaccessible content.

## 7. State And Data Boundaries

Do not collapse unrelated states into one badge or progress meter:

| Dimension | Examples | UI consequence |
| --- | --- | --- |
| Generation execution | Queued, creating template/modules/sections, writing, failed, finished | Owner-visible status and retry; not a learner grade |
| Editorial lifecycle | Wrapper, draft, under review, published, retired | Availability, creator tools, version behavior |
| Evidence/review | Missing supporting sources, unchecked, reviewed, issue reported | Honest local notices/details; no invented credibility score |
| Learning activity | Not started, visited, completed | Resume and completion; current progress utilities already distinguish viewed/completed |
| Assessment evidence | In progress, submitted, passed, not passed, awaiting feedback | Results and permissible completion; not inferred from time on page |
| Persistence/connection | Saving, saved locally, saved to account, offline, error | Accurate recovery and sync messaging |

These are conceptual dimensions, not instructions to add new enum strings to existing contracts. Adapt existing values; introduce additional states only with data/service support.

Backend-dependent features must have explicit prerequisites: real identity/authorization, account-isolated progress, published course/version access, durable jobs/checkpoints, submission persistence, and permission-safe source/artifact access. The UI can expose existing local behavior now but must not simulate those guarantees. See [HOST-01 through JOB-07 and UI-01 through UI-08](hosted-mvp-requirements.md).

## 8. Optional Add-Ins

None of these is required to implement the first redesign. Each needs a separate acceptance decision, data model, and operating cost check.

| Idea / inspiration | Potential value for Lycium | Dependency / reason to defer |
| --- | --- | --- |
| Skill map and targeted review: [Khan mastery](https://support.khanacademy.org/hc/en-us/articles/115002552631-What-are-Course-and-Unit-Mastery) | Show strengths and direct learners back to specific gaps | Reliable concept-to-question mapping, scoring and review model; no fake mastery |
| Step-aware study plan: [FutureLearn](https://futurelearn.zendesk.com/hc/en-us/articles/360012328320-How-to-start-a-course-on-FutureLearn) | Suggest a manageable next session without changing course scope | Trustworthy effort estimates; user-set schedule, not artificial deadlines |
| Agenda/calendar: [Canvas dashboard](https://community.instructure.com/en/en/kb/articles/664620-how-do-i-use-the-dashboard) | Aggregate genuine submissions/deadlines across courses | Dates, timezone handling, preferences, notification policy; no empty calendar at launch |
| Anchored private notes: [Udemy notes documentation](https://support.udemy.com/hc/en-us/sections/206457187-Course-player) | Revisit a specific block, lesson, or video moment | Private persistence, stable anchors, export/delete, behavior across course versions |
| Contextual tutor: [Brilliant](https://brilliant.org/) and [Codecademy](https://help.codecademy.com/hc/en-us/articles/23400751016859-AI-Features-available-on-Codecademy) | Explain or hint using the active lesson, not a disconnected chatbot | Grounding, cost limits, privacy, accessibility, and assessment-integrity policy |
| Interactive subject workspace: [Codecademy](https://help.codecademy.com/hc/en-us/articles/1260803449210-Updates-to-our-Learning-Environment) | Run code, inspect graphs, or manipulate a supported simulation beside instruction | Appropriate renderer, safe execution/tool service, real pedagogical use; not a universal three-pane layout |
| Course material pack: [MIT OpenCourseWare](https://ocw.mit.edu/courses/8-01sc-classical-mechanics-fall-2016/) | Portable readings, exercises, and references | License/access checks and usable export; course JSON portability does not permit redistributing all source files |
| Participation/completion record: [OpenLearn](https://www.open.edu/openlearn/free-courses/advantages-signing-on-free-course) | A useful record of work completed | Honest criteria, versioned evidence, verification; not an accredited qualification |
| Step-level discussion: [FutureLearn](https://www.futurelearn.com/courses/foundations-of-marketing-build-a-modern-marketing-plan) | Questions anchored to actual instruction | Moderation, abuse reporting, learner privacy, staffing, and enough participants |
| Optional study goals/streaks: [Brilliant streaks](https://brilliant.org/help/features/what-is-a-streak/) | Support a routine for learners who want it | Opt-out and privacy; should not punish missed days, imply mastery, or dominate the dashboard |
| Program pathway visualization: [Coursera catalog](https://www.coursera.org/browse) and [Brilliant paths](https://brilliant.org/help/features/what-are-learning-paths/) | Explain how related courses build toward an outcome | Correct prerequisite/requirement data and accessible list alternative; no graph for its own sake |
| Course-fit assistant | Ask about goals and suggest an existing suitable course before generation | Lycium-specific extension; requires trustworthy retrieval and scope comparison. Conventional search/filter remains available |

## 9. Implementation Plan

Research and planning do not authorize a big-bang UI rewrite. Approve the first prototype and deliver one complete learner flow before replacing all surfaces.

### Phase 0: Design And State Fixtures

- [x] Research ten platforms and identify transferable patterns with source/inspection limits.
- [x] Document proposed pages, shared components, states, optional ideas, and dependencies.
- [ ] Approve navigation vocabulary, learner/creator split, and first-release page scope.
- [ ] Produce responsive low-fidelity layouts for home, catalog, My Learning, course overview, reader, quiz/results, and Studio run/error.
- [ ] Compare two coherent visual treatments on the same reader and catalog fixtures; select one before spreading styles.
- [ ] Prepare representative fixtures: short/long titles, text/math/media, missing sources, no media, empty catalog, large outlines, active/completed courses, pending assessments, failed saves, and failed generation.

### Phase 1: Shared Foundations And Reader

- [ ] Consolidate semantic tokens, typography, controls, focus states, overlays, and theme behavior without rewriting data access.
- [ ] Implement the application/course shells and mobile navigation.
- [x] Redesign the reader, outline, citations, section notice, and completion/navigation controls.
- [ ] Redesign quiz/project presentation and results while preserving attempt/storage/completion behavior.
- [ ] Validate a full learning flow on real local courses before reusing the design elsewhere.

### Phase 2: Discovery And Personal Learning

- [ ] Add the distinct course overview and preserve existing lesson deep links.
- [ ] Redesign catalog/search/filter/results, preserving URL and back-navigation state.
- [x] Implement compact public home and My Learning; distinguish local saved data from account-backed data.
- [ ] Adapt program/group views to the same navigation, availability, and progress vocabulary.

### Phase 3: Creator Experience And Hosted Completion

- [ ] Group create/upload/run/retry/review/edit/preview into Studio without regressing existing local capabilities.
- [ ] Separate general preferences, account settings, and authorized AI/provider configuration.
- [ ] Connect hosted sign-in, ownership, published versions, synced attempts, and durable jobs when their backend guarantees exist.
- [ ] Run the hosted acceptance flow and address usability findings before public beta.

### Phase 4: Optional Enhancements

- [ ] Prioritize add-ins using observed learner difficulty, not competitor feature counts.
- [ ] Give each accepted add-in a separate contract, capability check, tests, and privacy/accessibility review.

### Existing Code Boundaries

| Area | Start here | Guardrail |
| --- | --- | --- |
| Routing/shell | [App](../apps/lycium-web/src/App.tsx), [client shell](../apps/lycium-web/src/app/LyciumClientShell.tsx), [routing helpers](../apps/lycium-web/src/utils/courseRouting.ts) | Preserve base-path handling, deep links, static export, and local/cloud adapters |
| Navigation/theme | [TopBar](../apps/lycium-web/src/components/TopBar/TopBar.tsx), [tokens](../apps/lycium-web/src/styles/tokens.css), shared Button/Dropdown/Modal | Reuse semantic tokens; replace inconsistent styles incrementally, not with a second styling system |
| Discovery/creation | [CourseCatalog](../apps/lycium-web/src/components/CourseCatalog/CourseCatalog.tsx), [CreateCourseModal](../apps/lycium-web/src/components/CourseCatalog/CreateCourseModal.tsx) | Separate view composition before moving generation or persistence logic |
| Learning | [CourseLearningLayout](../apps/lycium-web/src/components/CourseLearningLayout/CourseLearningLayout.tsx), [ContentView](../apps/lycium-web/src/components/ContentView/ContentView.tsx), Sidebar/CourseNav | Keep rendering/editing contract and stable section identity |
| Assessments | [QuizBlock](../apps/lycium-web/src/components/Quiz/QuizBlock.tsx), [ProjectBlock](../apps/lycium-web/src/components/ContentView/ProjectBlock.tsx), [progress helpers](../apps/lycium-web/src/utils/courseProgress.ts) | Preserve course-scoped attempts, randomization, timers, submission and completion rules |
| Data/services | [data-access package](../packages/data-access), [contracts](../packages/contracts), [runtime](../apps/lycium-web/src/runtime/appRuntime.ts) | Do not place new storage/API branches or guessed source/model states in presentation components |

Do not move or rewrite generation workflows just to change navigation. Do not migrate all CSS in one commit. Avoid unrelated changes in the already modified working tree. Retire old component/style paths only after their replacement passes the same behavior checks.

## 10. Verification And Decision Gates

### User Journeys

| Journey | Pass condition |
| --- | --- |
| First visit | Find an appropriate published course, inspect outcomes/outline, open a sample lesson without model setup |
| Return to study | My Learning resumes the saved section in one action and preserves course/version context |
| Study and navigate | Open/close outline, move between sections, inspect citations, and return without losing place |
| Assess and improve | Read rules, answer, survive reload, submit, understand permitted feedback, and revisit relevant lessons |
| Create and recover | Submit prompt/files, leave/reopen, locate progress/failure, and retry without re-entering the request |
| Repair and publish | Edit/regenerate an authorized section, inspect review findings, preview, and publish without corrupting learner records |
| Account/offline | Session expiry or network failure explains what is and is not saved and offers a recoverable next action |

### Test Matrix

- Exercise 320, 375/390, 768, 1280, and 1440 CSS-pixel widths; include short-height landscape, long titles, large outlines, light/dark/auto, 200% text resize, and 400% browser zoom/reflow.
- Verify keyboard-only operation, visible focus, screen-reader landmarks/form labels/announcements, reduced motion, touch menus, and dialogs with the software keyboard open.
- Use browser screenshots for visual regressions and actual interaction tests for menu dismissal, focus return, filter history, resume, citations, quiz persistence, and generation recovery. Screenshots alone cannot prove saving or authorization.
- Keep focused unit/component tests for state mapping and reusable controls. Retain existing contract/API tests; add integration tests at changed data boundaries rather than duplicating generation tests for styling work.
- Verify public/draft access, private source links, two accounts, two courses with overlapping quiz IDs, and different course versions in hosted staging. Cross-device testing requires the real backend, not two mocks reporting success.
- Distinguish empty data from request failure, incomplete generation from finished content, missing sources from blocked access, and completed activity from passed assessment in fixtures and assertions.

### Practical Success Criteria

- No page-level horizontal overflow for ordinary text/controls; no title, menu, notice, or sticky-bar overlap.
- A returning learner reaches the saved lesson with one Resume action; catalog-to-course/lesson navigation does not require opening incidental menus.
- The reader puts section identity and instruction ahead of repeated course/module headings and creator diagnostics. Test this with long titles rather than enforcing an unrealistic fixed "above the fold" word count.
- Every important state has a truthful label and a useful next action. No invisible failed generation, false saved state, fabricated progress percentage, or unearned mastery/review badge.
- Ask 3-5 representative learners to find a suitable course, resume, use the outline, take a quiz, and explain their result. Record task success, wrong turns, assistance needed, and confusion. This is formative feedback, not statistical proof; iterate on repeated problems.
- Use minimal, consent-appropriate product measurement later: time to first lesson, resume success, navigation errors, save failures, and issue-report completion. Do not equate clicks, time spent, or streaks with learning.

### Decisions Still To Approve

| Decision | Recommended starting point |
| --- | --- |
| Overall feel | Quiet academic library plus a focused reader; recognizable brand without marketplace clutter |
| Home | Compact discovery for visitors; My Learning for returning authenticated learners, with honest local-mode fallback |
| Dashboard scope | One My Learning destination; no separate analytics dashboard at launch |
| Catalog click behavior | Title opens overview; explicit Resume goes straight to saved learning |
| Creation placement | Studio destination; preserve existing local creation and recovery throughout migration |
| First prototype | Reader/quiz and catalog/overview using the same real-content fixtures, desktop and mobile |
| Optional add-ins | None automatically approved by this research; choose after the core learning flow is usable |

### First Implementation Checkpoint: 2026-11-19

The existing course-generation changes and this research plan were checkpointed in `fac5f72` before UI implementation. The first working visual treatment now covers:

- Semantic light/dark reading surfaces, shared keyboard focus, reduced motion, a skip link, and a restrained black top bar with Lucide icons.
- Catalog-local search/view controls, a full-width mobile search row, readable long titles, and native card-action buttons independent of secondary actions. Existing creation, generation status, filtering, and pagination remain in place.
- Lesson-first heading hierarchy, constrained reading width, a collapsible desktop outline, and a native modal mobile outline with focus containment, Escape/outside-click dismissal, and focus return.
- Compact source-coverage notices and section-scoped source footers. Missing-citation editing controls are hidden from learners; Apply sections have no source footer. The notice still reflects existing course-level coverage, not a newly implemented per-section source grade.
- Quiet quiz/project presentation and distinct completion/navigation controls. During regression testing, unfinished quiz answers were found not to persist; they now save and restore within the existing course-scoped attempt record.
- Native shared dialogs, including usable delete confirmations above the outline drawer. Escape dismisses an open dropdown before its containing dialog.

The reader header, catalog discovery header, and outline section rows have separate presentation components. Duplicate sidebar theme styles were removed rather than retaining two implementations.

Verification includes web unit tests and isolated Chromium desktop/mobile checks for 320/390/768/1280 reflow, long titles/equations, themes, keyboard dismissal/focus return, citations, quiz persistence and cross-course isolation, project submission reload, and course editing. Settings provider/model dropdowns are also checked inside the native dialog. Screenshots are generated as Playwright artifacts, not committed course assets.

Checkpoint results: 68 web unit tests, 26 focused reader/accessibility/editing browser checks, and 4 settings dropdown browser checks passed. TypeScript, focused ESLint, import/data-boundary guards, and the production build passed. These are scoped results, not a claim that the entire legacy end-to-end suite passes.

Remaining validation gaps: this is not a screen-reader audit, hosted account-isolation test, real-provider generation-quality test, user study, or completed full-browser-suite pass. A broader legacy test run exposed tests that still depend on the live backend and outdated card/creation contracts. The run was stopped; its accidental generation job was cancelled and retained as a failed test audit record. The focused presentation/editing/settings tests now intercept all API requests. Isolate and update the remaining legacy suites before treating the full suite as a release gate. The repository line-budget guard also still fails on existing oversized files; no budgets were raised for this increment.

Course overview, My Learning, public home, Studio, broader program-page redesign, and hosted guarantees are not implemented by this increment. Two alternative visual treatments were not produced. Next: review this treatment with real content, then implement the distinct course overview before moving to personal learning and creator navigation.

### Learner Pages And Login Entry: 2026-11-19

The first UI pass was committed as `c60d598` before this increment.

- `/` is a distinct Lycium home page rather than a catalog redirect. It has a compact photographic header, course discovery using actual catalog entries, subject filtering, and a resume action when saved activity exists. Discovery surfaces different available subjects without hardcoded course choices. Image attribution is recorded beside the bundled asset.
- `/my-learning` is the dashboard. It uses existing course-scoped bookmarks and completion records for active/completed lists, search, saved-section resume, section counts, and completion percentages. It does not invent grades, mastery, time studied, deadlines, enrollment, or account sync.
- The top bar now exposes Home, My Learning, Catalog, Settings, and Log in. Mobile keeps the navigation accessible without squeezing every label into the row. The brand opens Home; course deep links and catalog routes retain their existing roles.
- Log in opens a native dialog that explicitly states account sign-in is not available yet and offers a working local-learning path. There is no simulated login, credential collection, OAuth implementation, or authenticated session.
- Browsing Home, My Learning, or Catalog no longer marks the selected course's first lesson viewed. Progress updates are restricted to the reader.

The learner-library model has focused unit tests. Isolated desktop/mobile browser tests cover real navigation, image loading, subject filtering, dashboard counts, completed/search/empty states, resume and completion round-trips, reload persistence, cross-course isolation, 320-1440px reflow, dark mode, and login-dialog dismissal/focus return. Existing reader and manual-editing tests remain part of this increment's verification.

Checkpoint results: 74 web unit tests and 38 focused desktop/mobile browser tests passed, along with TypeScript, focused ESLint, import/data-boundary guards, and the production build. This does not supersede the legacy-suite and hosted-validation gaps recorded above.

Still open: distinct course overview, Studio, catalog URL-state persistence, durable enrollment/account sync, actual authentication, hosted access guarantees, and the broader accessibility/usability audit. The home and dashboard are working local-runtime pages, not evidence of public-launch readiness.

### Visual Product Pass: 2026-11-20

The previous checkpoint above is historical. This pass replaces its stock-library
hero and text-only course cards with bundled category artwork and a contemporary
visual system. My Learning now leads with a saved lesson and Continue action;
aggregate course/section KPI counters and motivational filler were removed.

Course titles and published catalog entries open a distinct overview: description,
available workload/level facts, prerequisites, and expandable curriculum. Start or
Resume enters the reader. Local editable drafts retain direct editor entry.
Overview visits do not create progress; curriculum locks use existing ordering
rules. Reader header progress no longer duplicates the outline. Shared buttons,
navigation, footer, settings surfaces, and program presentation have quieter
typography, consistent dimensions, and reduced decorative framing. Program
diagnostics are collapsed behind Program details, ahead of a visible learning path.

Loading/error states replace false empty-catalog flashes. Program deep links wait
for program loading before deciding whether a route is unknown. Existing saved
progress, section citations, assessments, editing, and generation/retry behavior
remain part of the verification scope.

Subject covers include computing (code plus a natural electronics workbench),
finance/economics (a stock chart on a monitor), physical engineering, chemistry,
humanities, and general learning. Selection uses department/tag/category metadata,
not course titles or changes to generation prompts. Asset provenance is bundled
with the images. The home still life has separate desktop and phone compositions.

Several panoramic library concepts were generated as previews for
a possible slow-panning home background: classical halls, a towering fantasy
rotunda, and a closer photorealistic collector-library revision with modern
artifacts and wooden rolling ladders. They are not part of the runtime bundle;
no animation or seamless-loop capability has been implemented or claimed.

Studio, URL-persisted catalog filters, authentication, enrollment/account sync,
hosted access guarantees, and full screen-reader/user studies remain open. Program
presentation was aligned visually; this is not a rewrite of its learning contracts.

Verification: 79 web unit tests and all 46 isolated Chromium desktop/mobile
browser checks passed. TypeScript, focused ESLint, import/data boundaries, and
the production build passed. Tests cover the new overview, ordered curriculum,
subject-image loading, program deep links, persistence, themes, assessments,
editing, and 320-1440px reflow. Earlier locator/pagination and navigation-wait
issues in the new tests were corrected before the final successful run. These
results do not claim that the unisolated legacy full suite or a screen-reader
audit passed. The development server was restarted after the production build.

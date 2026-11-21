# Site Navigation And Footer

Date: 2026-11-20. A shared header/footer pass following the
[Coursera study](coursera.md). The reference is a conventional discovery-first
information hierarchy, not a claim that every learning site uses one layout.

## Header

- Black, 72px site header; content aligned to the same width/gutters as pages.
- Consistent uppercase wordmark. The mobile L remains a home link.
- Desktop text navigation: Home, Catalog, My Learning, with current-page state.
- A real course-search form, rather than a decorative search field. Smaller
  layouts use a search dialog. Search submits GET `/catalog?q=...` with the
  configured deployment base path, then uses the existing catalog filter logic.
- A labeled mobile navigation dialog replaces an ambiguous row of tiny icons.
  Navigation/search dialogs reuse focus containment, Escape dismissal,
  backdrop dismissal, and focus restoration.
- Preserve the existing login-availability dialog. No fake authenticated menu,
  signup flow, notifications, account avatar, or disabled destination is added.
- Log in is a quiet text action, without a filled CTA treatment or sign-in icon.
  Settings lives in a top-right More options utility disclosure rather than a
  standalone public-navigation gear. It uses a native auto popover with keyboard
  access, Escape/click-away dismissal, and top-layer rendering.
- Normal browser modified-click behavior is retained for the catalog link.

The search URL is a reloadable entry query. The existing catalog's local edits,
other filters, and sorting are not all made URL-persistent by this increment.
Global search intentionally starts a fresh catalog search rather than carrying
filters from an unrelated scoped program/cluster view. GET submission performs
a normal page navigation; no new API endpoint or search service is introduced.

Settings placement is contextual, not a universal standard. Coursera documents
[account settings under the top-right name menu](https://www.coursera.support/s/article/learner-000001029?language=en_US).
Lycium does not have authenticated accounts yet, and its provider/theme settings
must remain available to guests. The utility disclosure is the interim fit;
actual account preferences can move under a real account menu when auth exists.

## Footer

- A full-width dark band with constrained inner content, not a floating panel.
- Wordmark and Protheus Labs identity; grouped Learn, Project, and Legal links.
- Only actual destinations: course/program catalog, My Learning, repository,
  issue tracker, and the existing legal documents. No invented About, Pricing,
  Contact, social accounts, or institution affiliations.
- External links have a visible external-link indicator and safe new-tab rel.
- A quiet copyright/bottom row. Footer links have at least 44px tap height.
- Responsive columns, with legal links wrapping rather than clipping on phones.
- Footer stays inside page scrolling. It is not pinned over lesson content and
  does not add a large footer to the reader's study workspace.

## Ownership And Verification

`TopBar` owns global chrome and dialog state; `SiteSearch` owns the shared form.
`useCatalogSearch` reads the entry query with an SSR-safe external-store snapshot
and keeps local input edits separate. `CatalogFooter` remains the shared footer
component; its legacy name is retained to avoid unrelated caller churn.

The legal page now has a real main-content skip target. A shared Modal fix
prevents backdrop pointer focus from overriding the restored trigger focus.

Check 320/390/768/900/1024/1101/1280/1440px, light/dark, header element overlap,
menu and search dismissal/focus return, repeat search and reload, footer legal
navigation, and existing study/edit/generation flows. Browser tests intercept
all application API calls; no generation providers are invoked.

Verification: 102 unit tests, TypeScript, focused ESLint, import/data boundaries,
and the production build passed. The 64-case focused browser run had 63 passes
and one phone test-target failure: its outside click was aimed at a title covered
by the open popup. The target was corrected; login/Settings, mobile dialogs, and
responsive chrome were rerun successfully on both browser profiles (6 checks).
This is not a full screen-reader audit or a claim about every supported browser.

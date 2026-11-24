# Lycium Visual Identity

## Direction

Modern academic minimalism: the clarity and permanence of an established
institution, the restraint of contemporary software, and learning tools that
feel native to the same product. Do not use the visual language of a colorful
EdTech startup, an AI operations dashboard, or a course marketplace.

## Core Contract

| Role | Value | Token |
| --- | --- | --- |
| Institutional branding/footer | `#000000` | `--lycium-institutional-black` |
| Primary action | `#176B55` | `--lycium-brand-primary`, light `--lycium-color-accent` |
| Hover action | `#10533F` | `--lycium-brand-primary-hover` |
| Light highlight | `#E7F2ED` | light `--lycium-color-accent-soft` |
| Dark accent | `#80D2B6` | dark `--lycium-color-accent` |
| Primary surface | `#FFFFFF` | light `--lycium-color-canvas` |
| Secondary surface | `#F7F8FB` | light `--lycium-color-surface` |
| Primary text | `#171717` | light `--lycium-color-text` |
| Secondary text | `#60686C` | light `--lycium-color-text-muted` |
| Dark canvas | `#1B1D1F` | `--lycium-dark-canvas` |

These values already drive the shared tokens. New surfaces should consume the
semantic tokens rather than introduce local palette variants. Emerald is a
functional accent, not a wash across every panel. Artwork may use cobalt,
coral, mint, and silver within the [course-artwork direction](course-artwork-style.md).

Body gutters use 24px on desktop and 16px on phones. The topbar and footer use
their own 16px gutters through `--lycium-header-gutter` and
`--lycium-footer-gutter`, matching the tighter chrome spacing without reducing
the course-content gutter. Individual pages should not reintroduce wider local
padding at intermediate breakpoints.

The header and footer are full width, without centering margins. The hero,
catalog, and learner-page body containers use the centered 84rem
`--lycium-content-max`. Reading columns retain their own measure constraints
for legibility.

The global header uses the current surface color, including in dark mode. A
course overview uses a near-black identity band inspired by Udemy's clear
global/course-context separation. Global and catalog search fields use a pill
radius; buttons use 8px corners and other action fields use 4px.

The 8px action radius, measured from Udemy's Log in control, applies consistently to buttons, dropdown triggers,
filters, pagination, and course-creation controls on the main learner pages.
Unboxed navigation links and tabs retain their text treatment. Catalog search
uses the same pill field, 44px height, border, and raised surface as global
search.

The public homepage leads with the existing learning artwork, a concrete value
proposition, Explore courses, and How it works. A compact Learn / Practice /
Assess section explains the real learning model. Empty public course inventory
is omitted rather than presented as a landing-page failure. A single filtered
course receives a larger split presentation. Unavailable account sign-in is not
shown as an action, and development-only tools are not promoted on the hero.

The heavy uppercase wordmark uses `--lycium-font-brand`; body and reading text
use the shared `--lycium-font-body` stack beginning with SF Pro Text and the
same native Roboto/Segoe UI fallbacks used by Udemy. We do not redistribute
Udemy Sans font files. Course/card headings and primary actions use 700 weight.
My Learning progress tabs indicate selection with text color and weight only,
without an active underline. A future bundled display family can replace
that token without changing individual components. Buttons use 8px radii; other controls use 4px radii,
cards use 8px, and borders do most of the separation work. Shadows remain
reserved for overlays and genuinely elevated surfaces.

## Application Priorities

1. Keep navigation, branding, type, color, spacing, and control behavior on the
   shared contract.
2. Maintain a clear, image-led homepage and scannable catalog with real course
   information rather than promotional claims.
3. Preserve focused reading, explicit assessment states, and responsive layouts
   designed for phones instead of compressed desktop grids.
4. Treat programs as academic pathways and keep generation diagnostics in the
   appropriate creator surface.

## Future Product Surfaces

The following are product directions, not prerequisites for the first release:

- A searchable Tools directory and native tool workspaces, beginning with a
  Orvane when that tool has a real implementation.
- Presentation Studio with supported interactive media and imports.
- A textbook reader with actual chapter, figure, equation, and annotation data.
- A digital library and any future Lycium Press collection.
- Contextual tutoring tied to course material and comprehension checks.

The Tools destination exists as a directory shell. Its Orvane entry is
marked `In development` and intentionally has no launch link until a usable tool
exists. Catalog creation and review live at `/studio`; public discovery contains
published courses only.

These surfaces should adopt the same tokens and primitives. Do not add empty
navigation entries, decorative mock tools, or claims of capability to establish
the visual identity.

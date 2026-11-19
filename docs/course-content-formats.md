# Course Content Formats

The renderer-backed format catalog is [course-content-formats.json](../packages/contracts/course-content-formats.json). Generation loads it when building a prompt; there is no cached copy to restart or hand-maintained format list in the section-fill prompt.

Each entry contains:

- `type`: the canonical content-block type.
- `label`: a short human-readable name.
- `workflows`: generation workflows allowed to emit the format.
- `useWhen`: teaching tasks that suit the format.
- `avoidWhen`: cases where a different format is more appropriate.
- `requirements`: field, asset, accessibility, and usage constraints.
- `example`: a small example of the block shape, not a lesson template.

Section fill loads only `section_fill` entries. Quizzes and projects are listed for their assessment workflows, not lesson writing. The shared behavioral contract also reads the catalog, so use-case and example edits reach generation without editing prompt code.

External formats still need real assets: listing an image or embed does not supply a diagram, video, or interactive tool. The model must not copy placeholder URLs from examples. A lesson can combine appropriate formats and should not use every type for variety.

To change guidance for an existing format, edit its catalog entry. A genuinely new block type still needs renderer/editor support and any applicable contract validation before it is added. Do not advertise planned code blocks, flashcards, or other unsupported formats.

## Checks

- The API validates the catalog, unique types, matching examples, and workflow selection before calling a model.
- Tests verify that catalog additions and edits appear in the next section-fill prompt.
- The web test parses the content renderer and verifies that every catalog type has a rendering case.
- Malformed catalog data fails visibly rather than falling back to a stale list.

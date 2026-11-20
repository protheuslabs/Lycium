# Course Artwork Style

Keep category artwork coherent without making every subject the same abstract
sculpture. These are decorative covers, not scientific diagrams or teaching
material. Never use them as evidence of course quality, actual market prices,
correct wiring, or functioning code.

## Shared Rules

- Wide 2:1 composition; the main subject must read at course-card size.
- Bright, soft daylight, clear materials, cool gray/ice-blue neutral surfaces.
- Restrained cobalt, coral, mint, silver accents. Subject-appropriate color is
  welcome; avoid an entirely purple, beige, or dark-blue site.
- Realistic scale and purposeful objects. No floating decorative shapes, neon
  glow, illegible headline text, institutional badges, or atmospheric blur.
- Consistent crop and cover dimensions across Catalog, My Learning, and overview.
- Screens can carry authentic-looking code or charts, while the surrounding
  lighting and materials connect them to the illustration family.

## Subject Direction

| Subject | Visual |
| --- | --- |
| Finance/economics | Actual-looking fictional candlestick chart, moving-average line, and volume bars on a slim monitor. No sculpted wire graph. |
| Computer science | Code editor on a laptop, with a believable electronics tinkering desk: small development board, breadboard, jumper wires, components, and tools. No giant diagonal PCB. |
| Physical engineering | Truss structure, gear, linkage, and engineering drawing with recognizable materials. |
| Chemistry | Glassware, molecular model, and lab equipment; not an instructional molecular diagram. |
| Humanities | Architectural artifacts, map material, and recognizable historical objects. |
| General learning/math | Prism and geometric objects; the home composition also has a portrait version. |

Selection lives in `src/utils/courseArtwork.ts` in the web app. Specific subject
metadata wins over broad category fallback; explicit subject tags also support
older courses. Do not infer from titles, add per-course exceptions, or alter
generation prompts to control a decorative cover.

The bundled assets are WebP. Prompt specifications and revision provenance are
in [the image README](../apps/lycium-web/src/assets/README.md). Keep rejected
variants outside the runtime bundle. Future authored covers should replace the
fallback through a dedicated presentation field, not changes to curriculum logic.

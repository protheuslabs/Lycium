# Image Credits

## Current Learning Artwork

`learning-world.webp`, `computing.webp`, and `humanities.webp` were generated with
the built-in OpenAI image tool on 2026-11-20. They are decorative editorial
category artwork, not instructional diagrams or photographs of a Lycium campus.
The application bundles these assets; no external image host is needed. PNG outputs
were encoded to WebP without altering their composition; originals remain in the
Codex generated-images directory.

Final prompt set (built-in mode, no input images, opaque backgrounds):

- `learning-world.webp`: Wide editorial studio still life for a modern open college
  learning platform: a clear optical prism bending light, cobalt folded geometric
  solid, orange architectural arch, small wireframe polyhedron on cool gray.
  Objects grouped right with pale negative space left for page text. Crisp tactile
  materials, cobalt/coral/mint accents; no text, logos, people, bookshelves,
  gradients, glowing orbs, or bokeh.
- `computing.webp`: Selected revision replaces the acrylic mechanism with a slim
  silver laptop displaying a dark code editor and a detailed blue-green printed
  circuit board on a natural tinkering desk. Final edit replaces the oversized
  diagonal PCB with a palm-sized development board lying flat, casually looping
  USB cable, solderless breadboard with jumper wires, loose resistors/capacitors,
  precision screwdriver, wire cutters, and multimeter probes. Realistic scale and
  casual asymmetry, bright cool-gray/ice-blue desktop and daylight; no decorative
  copper tracks, giant heatsink, people, headlines, or neon glow. The laptop/code
  revision was the edit reference; code and wiring are decorative, not teaching
  material or a wiring tutorial.
- `humanities.webp`: Wide humanities/history/social-sciences cover: terracotta
  Roman arch fragment, white carved classical column capital, translucent blue
  map tracing sheet, mustard architectural blocks on light pink. Museum-object
  photography with tactile materials; no text, logos, people, bookshelves, orbs,
  gradients, bokeh, or UI.

`learning-world-mobile.webp` is a built-in image-tool edit using the desktop
still life as its reference. Prompt: Recompose as a portrait 4:5 mobile hero,
preserving the prism, orange arch, cobalt solid, mint semicircle, and wireframe
polyhedron. Put all objects in the bottom 45% and leave the upper 55% empty pale
cool gray for dark heading, description, and buttons. Continuous seamless studio
background, crisp tactile materials and daylight; no panels, text, or logos.

Additional built-in image-tool covers added on 2026-11-20:

- `finance.webp`: the selected revision composites a realistic fictional stock
  chart (candlesticks, blue moving-average line, volume bars) onto a slim silver
  monitor. Bright cool-gray studio, small coral/mint objects; no wire sculpture,
  books, coins, logos, real ticker, or investment claim. The chart and main
  learning still life were supplied as content/style references. Rejected wire
  graph and full-frame chart variants are not bundled.
- `engineering.webp`: wide editorial studio scene with a brushed-silver
  structural truss bridge model on coral supports, steel gear, articulated
  linkage, translucent blue engineering drawing; pale blue surface, crisp light,
  no writing, people, logos, gradients, or bokeh.
- `chemistry.webp`: wide editorial studio scene with glass flask and beaker,
  blue/coral liquids, ball-and-stick molecular model, and test-tube rack on a
  pale lilac-gray surface. Crisp glass/materials; no formulas, logos, people,
  glowing objects, or UI. Decorative cover, not an instructional diagram.

All covers use a 2:1 frame, clear subject silhouettes, tactile materials, and
consistent daylight. Subject metadata selects the cover; no course title or
generation prompt is special-cased. Specific department metadata takes priority;
explicit subject tags provide a fallback for older misclassified courses.

## Library Motion Study

`library-collector.webp` is the collector close-up library concept generated and
edited with the built-in image tool on 2026-11-20. It is a poster/fallback for the
isolated library preview, not a seamless panorama or its 3D wall texture.

`library-walnut.webp` is a single generated material texture. Built-in tool prompt:
"Use case: product-mockup, 3D material texture. A single square perfectly flat
evenly lit close-up albedo texture of aged polished dark walnut wood for the
bookcases of a photorealistic historic library. Fine believable vertical wood
grain with subtle warm brown variation and restrained wear, elegant rich wood,
not orange, not black, no big knots, no planks or seams. Orthographic directly
overhead, neutral diffuse light without any directional highlights, cast shadows
or vignette. Seamlessly tileable on all four edges. No objects, text, borders,
logos, shapes or scene. This is one continuous wood material image, not an atlas
or a collage."

Both generated PNG sources were encoded to WebP without changing composition.
The generated walnut material is preserved for the earlier scene snapshots; the
active scene uses the scanned materials below. Book bindings, screens, leaf veins,
and subtle metal brushing remain procedural, not generated teaching content.

## Library Scanned Materials

The material pass uses original 1K JPEG color, OpenGL normal, and roughness maps
downloaded from Poly Haven on 2026-11-20, plus a 1K RGBE indoor lighting map.
These assets are [CC0](https://polyhaven.com/license) and bundled locally; the
application does not call Poly Haven's API or CDN at runtime.

- `library-materials/wood-*`: [Wood Table 001](https://polyhaven.com/a/wood_table_001).
- `library-materials/cloth-*`: [Poly Wool Herringbone](https://polyhaven.com/a/poly_wool_herringbone).
- `library-materials/marble-*`: [Marble 01](https://polyhaven.com/a/marble_01).
- `library-materials/floor-*`: [Large Floor Tiles 02](https://polyhaven.com/a/large_floor_tiles_02).
- `library-materials/leather-*`: [Brown Leather](https://polyhaven.com/a/brown_leather), used for book bindings.
- `public/library-materials/lebombo-1k.hdr`: [Lebombo](https://polyhaven.com/a/lebombo).

`library-materials/manifest.json` records the exact original URLs, file sizes,
and verified MD5 checksums supplied by the official API. Original image bytes
are unchanged. In the renderer, color maps use sRGB; normal and roughness data
use no color-space conversion. Roughness is remapped into matte finish ranges
at load time to prevent sharp moving HDR reflections. Normal-map strength,
texture scale, and material tint are also renderer settings, not source edits.

Book binding atlases combine the scanned leather/wool surfaces with deterministic
foil bands and restrained spine ornament. Cover tints vary per book; page-edge
textures are separate so paper does not inherit the binding color. Upholstery
has physical piping seams and a coarser, visible weave on seats and acoustic pods.

Maps and HDR total approximately 8.2 MiB. These are visualization assets, not
course sources or instructional diagrams. The pre-material approved scene is
preserved in `docs/design-snapshots/library-layout-v2/`.

## Previous Home Image (Unused)

`library.jpg`: University library photograph by Zoshua Colah, downloaded from
[Unsplash](https://unsplash.com/photos/D986zlYJSAc) under the
[Unsplash license](https://unsplash.com/license).

Used as a general reading/library image, not as a photograph of a Lycium campus.

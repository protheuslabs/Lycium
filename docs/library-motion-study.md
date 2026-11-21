# Library Motion Study

Route: `/library-preview` (under the configured deployment base path).

## Scanned-Material Pass

The approved pre-material scene is frozen in
`docs/design-snapshots/library-layout-v2/`. Camera framing, room size, pod geometry,
and the furnishing layout remain unchanged in this pass.

The active scene now uses bundled Poly Haven color/normal/roughness sets for
wood, woven upholstery, marble, and stone tiles, plus an indoor HDR environment.
See `src/assets/README.md` and the asset manifest for provenance and checksums.
Box faces, curved bookcases, columns, rugs, and pod shells use material-scale
UVs rather than stretching one image across every object.

Illumination sources stay fixed in room coordinates, never parented to the
camera. The HDR environment has a fixed orientation and subdued intensity;
matte roughness ranges suppress the sweeping window-reflection band on wood
and other surfaces. Small physically view-dependent reflections are not moving
lights. Static shadows and the deterministic camera loop are preserved.

Plants use elongated pointed, ribbed leaf meshes whose bases connect directly
to a tapered green stalk. Side stems are removed. Leaves retain their uniform
dark green and upward angle. Precise transformed-vertex bounds ground spinning
chairs in both lean directions; the old rotated-box approximation lifted them.

This is a material/lighting improvement to the interactive 3D study, not a claim
that its simple artifact meshes are production-quality photorealistic models.

Pod panels use a coarser wool weave than the seating. Rounded upholstered
cushions have subtle piping seams. Three cloth/leather binding finishes are
distributed across the shelves and carts, with separate paper-edge geometry and
texture so page edges do not inherit each book's cover tint. These details do
not change furniture placement or the approved pod shape.

This is an isolated Three.js geometry/camera prototype, not the finished
photorealistic homepage or a replacement for its existing hero. The collector
library image is art direction and a loading/WebGL fallback, not a texture being
slid across the screen. The ready preview renders actual shelves, books,
galleries, ladders, reading furniture, and simple historical/technical artifacts.

## Current Framing

The initial near-wall 45-degree orbit was too close and steep. The revised room
is deliberately expansive rather than a smaller rotunda:

- Room diameter: 96 meters, about 315 feet.
- Shelf height: 30.48 meters, 100 feet.
- Camera orbit radius: 30 meters, a broad 60-meter-diameter path.
- Camera distance from the outer wall: 18 meters, about 59 feet.
- Eye height: 1.65 meters. Upward pitch: 18 degrees.
- Default revolution: 120 seconds, approximately walking speed along the path.

These values live together in `libraryOrbit.ts`. The room and camera radii are
separate; moving the camera back must not inadvertently shrink the room. The
perspective camera is constrained to the same outward wall-relative heading and
pitch throughout the circuit. This is not a stationary center-camera rotation.

## Loop Construction

Camera coordinates and its look-at target are pure functions of normalized
phase. A complete turn wraps to exactly the initial position and orientation.
Geometry, procedural variation, lighting, and artifact poses are deterministic;
clocks and screens do not introduce unrelated time-based animation. There is no
crossfade or hidden camera teleport.

The shelf fronts and books are nearly flush, preventing foreground shelf lips
from hiding most of the upper books when viewed from below. Galleries are
shallow enough to preserve the wall-height view. Furniture and ordinary rolling
wooden ladders provide human-scale references.

## Study Areas And Collection

The original scene is preserved in `docs/design-snapshots/library-base-v1/`
with a frozen source/texture archive, screenshot, checksum, and recovery notes.
That snapshot predates the furnishing changes below.

The expanded scene has 240 wall displays across all five levels, with scrolls,
classical busts, amphorae, globes, clocks, telescopes, microscopes, cameras, radios,
early computers, laptops, and circuit boards. Books still occupy most shelves.
Objects sit on the reserved display shelves rather than floating in the room.

The main floor has 42 staggered curved study pods with mustard cushions and
writing desks, 12 shared six-seat reading tables, six upholstered armchair areas
with footstools and reading lamps, six sofa groups, 12 individual carrels, and 12
red/blue/orange sculptural-chair pairs with side tables.
The sculptural chairs tilt about 20 degrees sideways with a
small backward lean, both in the same direction rather than toward each other;
their transformed bounds keep them resting on the floor.
Three staggered pod rows use five varied wall-relative headings, leaving the camera circuit clear.
Inside each pod, the seat and desk turn together 90 degrees to the opening.
The white semicircular desktop follows the inner wall opposite the seat. It is
a wall-mounted pod fixture, with no pedestal, base, or floor-standing legs.
The desk-side shell ends exactly at the desktop's curved edge. On the seat side,
the shell extends until its inner edge aligns with the back of the seat in
profile. This makes an approximately 307-degree enclosure with a 53-degree
entry opening, without extending the desk-side wall past the desktop.
Seats sit back against the curved wall at their rear corners; wall-mounted
whiteboards and their clips are removed. The white desktop is unchanged.
The spinning-chair underside tapers from its wide lower rim to a pointed tip.
Twelve individual study carrels add screened desks, lamps, and padded chairs near
the shelves. Six former armchair areas are now sofa groups with facing cushioned
sofas and low reading tables; six armchair areas remain. This adds furniture
variety without filling the open center or changing the room/camera dimensions.
Eighteen potted plants separate study zones, with six nearer the middle. Six
additional pods sit in visible foreground gaps, leaving at least two meters clear
beside the camera circuit. Six standalone red/blue/orange spinning chairs sit in
the middle distance, 11 meters beyond the camera path, and lean in the opposite
direction to the paired chairs.
Leaves rise outward at 45 degrees to
horizontal at every position around the stem. Six book carts and six paired
waste/recycling stations sit in foreground gaps between study zones, outside
furniture and camera clearances. These were moved from the back wall because the
pods hid them in the wide camera view. Carts have three book-filled shelves;
bins have distinct blue/green tops and panels. Bags and notebooks also appear
at sofa groups, where they read more clearly than distant desk accessories.
Each cart shelf has 18-20 closely packed books leaning together; adjacent shelves
lean in opposite directions. Carts turn 36 degrees from their wall-relative
heading to show their depth. Books vary in size and muted textured
cover color. Each cart uses its own deterministic arrangement. Plants have
uniform dark-green leaves and larger, rounded ceramic pots.
Only some tables have backpacks, mugs, notebooks, pencils, headphones, and laptop
screens; communal tables have charging strips and blue woven rugs. Muted stone
floor tiles and warmer, lower-intensity lighting replace the bright plain floor.
Rugs and tile joints have stronger contrast for the wide view. Small desk props
remain human-sized and are not expected to be legible at every camera position.
Furniture and plants cast static directional shadows onto floors and rugs. The
2048-pixel shadow map is rendered once because the scene objects do not move.
Paused views reuse the rendered canvas rather than redrawing identical frames.
Resize and recording startup explicitly request a fresh frame.
These remain modeled prototype details, not photorealistic production assets.
The user-supplied photos guide the furniture shapes, not the
room architecture. Furnishings remain human-sized and leave the camera circuit
clear; the library dimensions and camera framing are unchanged.

## Code Boundaries

- `libraryOrbit.ts`: dimensions, periodic camera math, deterministic variation.
- `libraryMaterials.ts`: material/texture creation and disposal.
- `librarySurfaceMaps.ts`: bundled PBR map loading, roles, and matte roughness.
- `libraryTextureScale.ts`: physical UV scale and roughness data remapping.
- `libraryPlantGeometry.ts`: tapered, pointed leaf surface geometry.
- `libraryBookGeometry.ts`: distinct cover and inset page-edge surfaces.
- `libraryUpholstery.ts`: piping around rounded cushions.
- `libraryArchitecture.ts`: curved bookcases, instanced books, galleries, dome.
- `libraryArtifacts.ts`: ladders and historical/technical display objects.
- `libraryFurniture.ts`: study pods, reading tables, and lounge furniture.
- `libraryDetails.ts`: plants, book carts, bins, charging, and selective belongings.
- `libraryLayout.ts`: deterministic placements and clearances.
- `libraryGeometry.ts`: shared primitive construction and repeated-mesh batching.
- `libraryRenderer.ts`: Three.js scene, lighting, resize, camera, GPU cleanup.
- `useLibraryScene.ts`: playback, visibility, capture, error handling, lifecycle.
- `LibraryPreview.tsx`: semantic controls and reduced-motion preference.

The route does not mount course/provider workflows or make generation requests.
Three.js loads only when this preview is opened. Course-generation prompts and
course data are unchanged.

## Capture And Accessibility

Native canvas capture and MediaRecorder export one complete revolution at the
selected duration. The browser chooses a supported WebM codec, with MP4 as a
capability-based fallback. This is a real-time browser capture, not an offline
production render: frame rate and quality depend on the device. Export is
cancelled if the tab becomes hidden, rather than silently writing an interrupted
loop. A still-frame PNG export is also available.

Reduced motion disables automatic playback. Play remains available as an explicit
choice. Pause, restart, a keyboard-operable position slider, loop duration, save,
and export controls have accessible names. WebGL failure shows the reference
image and a readable error. Context loss cancels capture and falls back as well.

## Verification

Unit tests cover fixed distance/height/pitch, exact full-turn pose equality,
continuity around the boundary, invalid phases, and repeatable variation.
Layout tests cover furniture variety, non-overlap, walking clearances, and the
count/placement of wall artifacts. Repeated objects are batched by material and
instanced to avoid one draw call per chair leg or artifact component.

The isolated browser suite checks actual WebGL pixel diversity/opacity, matching
start/full-turn canvas images, 320/390/768/1440 layouts, moving pixels, reduced
motion, native PNG download, complete video export, and unavailable-WebGL fallback.

Run `corepack pnpm --filter @lycium/web e2e e2e/library-preview.spec.ts`.
Software WebGL is enabled only inside this isolated test browser, not in users'
browser configuration.

## Before Homepage Use

Approve camera scale and motion first. Replace prototype artifacts/materials with
properly authored production assets, improve lighting/shadows and architectural
details, and verify performance on real mobile hardware. Then render a compressed
video with a known frame count and inspect the join, codec behavior, autoplay,
reduced motion, still fallback, and transfer size. A correct camera loop alone
does not establish photorealistic visual quality or production-ready delivery.

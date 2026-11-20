# Library Motion Study

Route: `/library-preview` (under the configured deployment base path).

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

The main floor has 12 of each study-area type: shared six-seat reading tables,
curved acoustic study pods with mustard cushions and writing desks, upholstered
armchair pairs with footstools and reading lamps, and red sculptural-chair pairs
with side tables. The user-supplied photos guide the furniture shapes, not the
room architecture. Furnishings remain human-sized and leave the camera circuit
clear; the library dimensions and camera framing are unchanged.

## Code Boundaries

- `libraryOrbit.ts`: dimensions, periodic camera math, deterministic variation.
- `libraryMaterials.ts`: material/texture creation and disposal.
- `libraryArchitecture.ts`: curved bookcases, instanced books, galleries, dome.
- `libraryArtifacts.ts`: ladders and historical/technical display objects.
- `libraryFurniture.ts`: study pods, reading tables, and lounge furniture.
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

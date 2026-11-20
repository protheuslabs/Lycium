import { describe, expect, it } from "vitest";
import { libraryStudyAreas, libraryWallDisplays } from "./libraryLayout";
import { LIBRARY } from "./libraryOrbit";

describe("library furnishing layout", () => {
  it("keeps all four types of study spaces around the full room", () => {
    const areas = libraryStudyAreas();
    for (const kind of ["table", "pod", "lounge", "sculptural"]) {
      expect(areas.filter((area) => area.kind === kind)).toHaveLength(12);
    }
    expect(libraryStudyAreas()).toEqual(areas);
  });

  it("leaves a clear camera circuit and wall-side passage without shrinking the room", () => {
    expect(LIBRARY.wallRadius).toBe(48);
    expect(LIBRARY.cameraRadius).toBe(30);
    for (const area of libraryStudyAreas()) {
      expect(area.radius - area.footprint - LIBRARY.cameraRadius).toBeGreaterThan(2);
      expect(LIBRARY.wallRadius - area.radius - area.footprint).toBeGreaterThan(2);
    }
  });

  it("does not overlap the study areas", () => {
    const areas = libraryStudyAreas();
    for (let first = 0; first < areas.length; first += 1) for (let second = first + 1; second < areas.length; second += 1) {
      const a = areas[first];
      const b = areas[second];
      const distance = Math.hypot(Math.sin(a.angle) * a.radius - Math.sin(b.angle) * b.radius, Math.cos(a.angle) * a.radius - Math.cos(b.angle) * b.radius);
      expect(distance).toBeGreaterThan(a.footprint + b.footprint + 0.4);
    }
  });

  it("fills the reserved wall alcoves with varied, shelf-aligned artifacts on every level", () => {
    const displays = libraryWallDisplays();
    expect(displays).toHaveLength(240);
    expect(new Set(displays.map((display) => display.variant)).size).toBe(12);
    for (const display of displays) {
      expect(display.radius).toBeGreaterThan(LIBRARY.wallRadius - 1);
      expect(display.height).toBeGreaterThan(0);
      expect(display.height + 0.75).toBeLessThan(LIBRARY.shelfHeight);
    }
  });
});

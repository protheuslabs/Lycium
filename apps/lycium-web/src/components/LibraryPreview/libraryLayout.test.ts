import { describe, expect, it } from "vitest";
import { libraryStudyAreas, libraryUtilityAreas, libraryWallDisplays } from "./libraryLayout";
import { LIBRARY } from "./libraryOrbit";

describe("library furnishing layout", () => {
  it("keeps all study space types around the full room", () => {
    const areas = libraryStudyAreas();
    for (const [kind, count] of Object.entries({ table: 12, pod: 42, lounge: 6, sculptural: 12, carrel: 12, sofa: 6, topChair: 6 })) {
      expect(areas.filter((area) => area.kind === kind)).toHaveLength(count);
    }
    expect(libraryStudyAreas()).toEqual(areas);
  });

  it("varies pod headings relative to the wall instead of pointing them all inward", () => {
    const pods = libraryStudyAreas().filter((area) => area.kind === "pod");
    expect(new Set(pods.map((pod) => (pod.rotation - pod.angle).toFixed(2))).size).toBe(5);
  });

  it("keeps standalone spinning chairs in the middle distance", () => {
    for (const chair of libraryStudyAreas().filter((area) => area.kind === "topChair")) {
      expect(chair.radius - LIBRARY.cameraRadius).toBeGreaterThanOrEqual(8);
      expect(chair.radius - LIBRARY.cameraRadius).toBeLessThanOrEqual(12);
    }
  });

  it("leaves a clear camera circuit and wall-side passage without shrinking the room", () => {
    expect(LIBRARY.wallRadius).toBe(48);
    expect(LIBRARY.cameraRadius).toBe(30);
    for (const area of libraryStudyAreas()) {
      expect(Math.abs(area.radius - LIBRARY.cameraRadius) - area.footprint).toBeGreaterThan(2);
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

  it("keeps plants and service carts out of study areas and walking routes", () => {
    const utilities = libraryUtilityAreas();
    expect(utilities.filter((area) => area.kind === "plant")).toHaveLength(18);
    expect(utilities.filter((area) => area.kind === "cart")).toHaveLength(6);
    expect(utilities.filter((area) => area.kind === "bin")).toHaveLength(6);
    expect(libraryUtilityAreas()).toEqual(utilities);
    for (const area of utilities.filter((area) => area.kind !== "plant")) {
      expect(area.radius - LIBRARY.cameraRadius).toBeLessThanOrEqual(6);
    }
    for (const utility of utilities) {
      expect(utility.radius - utility.footprint - LIBRARY.cameraRadius).toBeGreaterThan(2);
      expect(utility.radius + utility.footprint).toBeLessThan(LIBRARY.wallRadius - 1);
      for (const area of libraryStudyAreas()) {
        const distance = Math.hypot(Math.sin(area.angle) * area.radius - Math.sin(utility.angle) * utility.radius, Math.cos(area.angle) * area.radius - Math.cos(utility.angle) * utility.radius);
        expect(distance).toBeGreaterThan(area.footprint + utility.footprint + 0.3);
      }
    }
  });
});

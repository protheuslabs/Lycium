import { describe, expect, it } from "vitest";
import { LIBRARY, libraryCameraPose, seededRandom, wrapPhase } from "./libraryOrbit";

describe("library camera orbit", () => {
  it("returns to exactly the same camera pose after complete revolutions", () => {
    expect(libraryCameraPose(1)).toEqual(libraryCameraPose(0));
    expect(libraryCameraPose(2)).toEqual(libraryCameraPose(0));
    expect(libraryCameraPose(-1)).toEqual(libraryCameraPose(0));
  });

  it("maintains the broad orbit, eye height, shelf distance, and gentle upward pitch", () => {
    for (let index = 0; index < 100; index += 1) {
      const { position, target } = libraryCameraPose(index / 100);
      expect(Math.hypot(position.x, position.z)).toBeCloseTo(LIBRARY.cameraRadius, 10);
      expect(position.y).toBe(LIBRARY.eyeHeight);
      expect(Math.hypot(target.x, target.z)).toBeCloseTo(LIBRARY.wallRadius, 10);
      const horizontalDistance = Math.hypot(target.x - position.x, target.z - position.z);
      expect(horizontalDistance).toBeCloseTo(LIBRARY.wallRadius - LIBRARY.cameraRadius, 10);
      expect(Math.atan2(target.y - position.y, horizontalDistance) * 180 / Math.PI).toBeCloseTo(LIBRARY.pitchDegrees, 10);
    }
  });

  it("has no discontinuity in speed or heading at the wrap", () => {
    const before = libraryCameraPose(1 - 0.00001).position;
    const after = libraryCameraPose(0.00001).position;
    expect(Math.hypot(before.x - after.x, before.z - after.z)).toBeLessThan(0.004);
  });

  it("normalizes invalid phases and creates repeatable scene variation", () => {
    expect(wrapPhase(Number.NaN)).toBe(0);
    expect(wrapPhase(-0.25)).toBe(0.75);
    const first = seededRandom(42);
    const second = seededRandom(42);
    expect(Array.from({ length: 12 }, first)).toEqual(Array.from({ length: 12 }, second));
  });
});

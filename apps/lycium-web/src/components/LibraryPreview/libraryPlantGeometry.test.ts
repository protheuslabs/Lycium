import { describe, expect, it } from "vitest";
import { createLibraryLeaf } from "./libraryPlantGeometry";

describe("library leaf geometry", () => {
  it("is elongated with a pointed tip and its base at the stalk attachment origin", () => {
    const leaf = createLibraryLeaf();
    leaf.computeBoundingBox();
    const bounds = leaf.boundingBox!;
    expect(bounds.max.z - bounds.min.z).toBeGreaterThan((bounds.max.x - bounds.min.x) * 4);
    const positions = leaf.getAttribute("position");
    for (let index = 0; index < 3; index += 1) {
      expect(positions.getX(index)).toBeCloseTo(0);
      expect(positions.getY(index)).toBe(0);
      expect(positions.getZ(index)).toBe(0);
    }
    for (let index = positions.count - 3; index < positions.count; index += 1) {
      expect(positions.getX(index)).toBeCloseTo(0);
      expect(positions.getZ(index)).toBeCloseTo(0.56);
    }
    for (const attribute of Object.values(leaf.attributes)) {
      expect(Array.from(attribute.array).every(Number.isFinite)).toBe(true);
    }
    leaf.dispose();
  });
});

import { describe, expect, it } from "vitest";
import { createBookFaceGeometry } from "./libraryBookGeometry";

describe("bound-book surfaces", () => {
  it("separates binding faces from page edges without missing or duplicating faces", () => {
    const cover = createBookFaceGeometry([1, 1, 1], [0, 1, 5]);
    const pages = createBookFaceGeometry([0.88, 0.94, 0.94], [2, 3, 4]);
    expect(cover.index!.count + pages.index!.count).toBe(36);
    const coverVertices = new Set(Array.from(cover.index!.array));
    expect(Array.from(pages.index!.array).every((vertex) => !coverVertices.has(vertex))).toBe(true);
    pages.computeBoundingBox();
    expect(pages.boundingBox!.max.x).toBeCloseTo(0.44);
    expect(pages.boundingBox!.max.y).toBeCloseTo(0.47);
    cover.dispose();
    pages.dispose();
  });
});

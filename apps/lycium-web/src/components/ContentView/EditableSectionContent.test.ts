import { describe, expect, it } from "vitest";
import { blockDragTargetIndex } from "./EditableSectionContent";

describe("blockDragTargetIndex", () => {
  it("moves upward according to the hovered block half", () => {
    expect(blockDragTargetIndex(3, 1, 110, 100, 40)).toBe(1);
    expect(blockDragTargetIndex(3, 1, 130, 100, 40)).toBe(2);
  });

  it("adjusts downward targets after removing the dragged block", () => {
    expect(blockDragTargetIndex(0, 2, 210, 200, 40)).toBe(1);
    expect(blockDragTargetIndex(0, 2, 230, 200, 40)).toBe(2);
  });

  it("keeps the current index while hovering over the dragged block", () => {
    expect(blockDragTargetIndex(2, 2, 210, 200, 40)).toBe(2);
    expect(blockDragTargetIndex(2, 2, 230, 200, 40)).toBe(2);
  });
});

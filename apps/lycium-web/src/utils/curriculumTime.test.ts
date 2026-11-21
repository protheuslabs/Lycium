import { describe, expect, it } from "vitest";
import { estimateSectionTime, formatCompactTimeEstimate } from "./curriculumTime";

describe("compact section time", () => {
  it("uses authored minutes without inventing missing estimates", () => {
    expect(formatCompactTimeEstimate(estimateSectionTime({ id: "one", title: "One", content: [], estimatedMinutes: 12 }))).toBe("~12 min");
    expect(formatCompactTimeEstimate(estimateSectionTime({ id: "two", title: "Two", content: [], estimatedHours: 1 }))).toBe("~1 hour");
    expect(formatCompactTimeEstimate(estimateSectionTime({ id: "three", title: "Three", content: [] }))).toBeNull();
  });
});

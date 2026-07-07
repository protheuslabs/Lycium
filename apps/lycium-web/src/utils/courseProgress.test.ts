import { describe, expect, it } from "vitest";
import { markSectionSeen } from "./courseProgress";

describe("markSectionSeen", () => {
  it("adds a seen status without mutating the original record", () => {
    const progress = { completedSectionIds: [], sectionStatuses: {} };
    const result = markSectionSeen(progress, "section-1");

    expect(result).not.toBe(progress);
    expect(result.sectionStatuses).toEqual({ "section-1": "seen" });
    expect(progress.sectionStatuses).toEqual({});
  });

  it("preserves completed and timed statuses", () => {
    const completed = { completedSectionIds: ["section-1"], sectionStatuses: { "section-1": "completed" as const } };
    const timed = { completedSectionIds: [], sectionStatuses: { "section-1": "timed" as const } };

    expect(markSectionSeen(completed, "section-1")).toBe(completed);
    expect(markSectionSeen(timed, "section-1")).toBe(timed);
  });
});

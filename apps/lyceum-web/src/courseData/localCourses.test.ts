import { describe, expect, it } from "vitest";
import { localCourses } from "./localCourses";

describe("local course registry", () => {
  it("rebuilds split course data with modules and sections", () => {
    expect(localCourses.length).toBeGreaterThanOrEqual(5);

    for (const course of localCourses) {
      expect(course.title).toBe(course.data.title);
      expect(course.data.modules.length).toBeGreaterThan(0);
      expect(course.data.modules.every((module) => module.sections.length > 0)).toBe(true);
    }
  });

  it("keeps course keys unique", () => {
    const keys = localCourses.map((course) => course.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

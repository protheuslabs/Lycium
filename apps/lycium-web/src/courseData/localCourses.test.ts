import { describe, expect, it } from "vitest";
import { validateCourseTaxonomy } from "@lycium/contracts";
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

  it("keeps every local course in a valid college and department", () => {
    for (const course of localCourses) {
      expect(validateCourseTaxonomy(course.data), course.key).toEqual([]);
    }
  });
});

import { describe, expect, it } from "vitest";
import { validateCourseTaxonomy } from "@lycium/contracts";
import { localCourses } from "./localCourses";

describe("local course registry", () => {
  it("starts with no seeded sample courses", () => {
    expect(localCourses).toEqual([]);
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

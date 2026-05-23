import { describe, expect, it } from "vitest";
import type { CourseEntry, CourseSection } from "../courseTypes";
import {
  getCoursePathSlug,
  getCourseSectionPath,
  getSectionPathSlug,
  parseCourseRoute,
} from "./courseRouting";

const section: CourseSection = {
  id: "intro-to-routes",
  title: "Intro to Routes",
  content: [{ type: "text", value: "Routing basics" }],
};

const course: CourseEntry = {
  key: "local-routing",
  title: "Routing & URLs",
  source: "local",
  data: {
    title: "Routing & URLs",
    modules: [{ id: "module-1", title: "Module 1", sections: [section] }],
  },
};

describe("course routing helpers", () => {
  it("builds stable course and section slugs", () => {
    expect(getCoursePathSlug(course)).toBe("routing-urls-local-routing");
    expect(getSectionPathSlug(section)).toBe("intro-to-routes");
    expect(getCourseSectionPath(course, section)).toBe("/courses/routing-urls-local-routing/units/intro-to-routes");
  });

  it("parses home, settings, course, and unit routes", () => {
    expect(parseCourseRoute("/")).toEqual({ kind: "home", courseSlug: null, unitSlug: null });
    expect(parseCourseRoute("/settings")).toEqual({ kind: "settings", courseSlug: null, unitSlug: null });
    expect(parseCourseRoute("/courses/routing-urls-local-routing")).toEqual({
      kind: "course",
      courseSlug: "routing-urls-local-routing",
      unitSlug: null,
    });
    expect(parseCourseRoute("/courses/routing-urls-local-routing/units/intro-to-routes")).toEqual({
      kind: "course",
      courseSlug: "routing-urls-local-routing",
      unitSlug: "intro-to-routes",
    });
  });
});

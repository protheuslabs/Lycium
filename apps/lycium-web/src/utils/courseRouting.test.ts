import { describe, expect, it } from "vitest";
import type { CourseEntry, CourseSection } from "../courseTypes";
import {
  COURSE_CATALOG_PATH,
  LYCIUM_SITE_ROOT,
  SETTINGS_PATH,
  getCoursePath,
  getCoursePathSlug,
  getCourseSectionPath,
  getCourseSectionUrl,
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
    expect(COURSE_CATALOG_PATH).toBe("/catalog");
    expect(getCoursePath(course)).toBe("/courses/routing-urls-local-routing");
    expect(getCourseSectionPath(course, section)).toBe("/courses/routing-urls-local-routing/units/intro-to-routes");
    expect(getCourseSectionUrl(course, section)).toBe(
      `${LYCIUM_SITE_ROOT}courses/routing-urls-local-routing/units/intro-to-routes`
    );
  });

  it("parses home, settings, course, and unit routes", () => {
    expect(parseCourseRoute("/")).toEqual({ kind: "home", courseSlug: null, unitSlug: null });
    expect(parseCourseRoute("/Lycium")).toEqual({ kind: "home", courseSlug: null, unitSlug: null });
    expect(parseCourseRoute("/Lycium/catalog")).toEqual({ kind: "home", courseSlug: null, unitSlug: null });
    expect(parseCourseRoute(COURSE_CATALOG_PATH)).toEqual({ kind: "home", courseSlug: null, unitSlug: null });
    expect(parseCourseRoute("/settings")).toEqual({ kind: "settings", courseSlug: null, unitSlug: null });
    expect(parseCourseRoute(SETTINGS_PATH)).toEqual({ kind: "settings", courseSlug: null, unitSlug: null });
    expect(parseCourseRoute("/courses/routing-urls-local-routing")).toEqual({
      kind: "course",
      courseSlug: "routing-urls-local-routing",
      unitSlug: null,
    });
    expect(parseCourseRoute("/Lycium/courses/routing-urls-local-routing/units/intro-to-routes")).toEqual({
      kind: "course",
      courseSlug: "routing-urls-local-routing",
      unitSlug: "intro-to-routes",
    });
    expect(parseCourseRoute("https://lyciumlabs.github.io/Lycium/courses/routing-urls-local-routing")).toEqual({
      kind: "course",
      courseSlug: "routing-urls-local-routing",
      unitSlug: null,
    });
  });
});

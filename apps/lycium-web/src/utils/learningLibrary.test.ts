import { describe, expect, it } from "vitest";
import type { CourseEntry } from "../courseTypes";
import { buildLearningLibrary, selectDiscoveryCourses } from "./learningLibrary";

const course: CourseEntry = {
  key: "first",
  title: "First course",
  source: "local",
  status: "published",
  data: {
    title: "First course",
    modules: [
      {
        id: "module",
        title: "Module",
        sections: [
          { id: "one", title: "First section", content: [{ type: "text", value: "A lesson." }] },
          {
            id: "two",
            title: "Second section",
            content: [{ type: "text", value: "Another lesson." }],
          },
        ],
      },
    ],
  },
};

describe("learning library", () => {
  it("derives curriculum locks from the complete prerequisite sequence", () => {
    const ordered = { ...course, data: { ...course.data, orderMandatory: true } };
    expect(buildLearningLibrary([ordered], {}).items[0].sectionStatuses.two).toBe("locked");
    const library = buildLearningLibrary([ordered], {
      first: { bookmark: null, progress: { completedSectionIds: ["one"], sectionStatuses: { two: "locked" } } },
    });
    expect(library.items[0].sectionStatuses.two).toBeUndefined();
  });
  it("surfaces different subjects without hardcoding course choices", () => {
    const courses = [
      { ...course, data: { ...course.data, category: "arts-humanities", department: "history" } },
      {
        ...course,
        key: "similar",
        data: { ...course.data, category: "arts-humanities", department: "history" },
      },
      {
        ...course,
        key: "different",
        data: { ...course.data, category: "business-management", department: "economics" },
      },
    ];
    const library = buildLearningLibrary(courses, {});
    expect(selectDiscoveryCourses(library.items, "all", 2).map((item) => item.course.key)).toEqual([
      "first",
      "different",
    ]);
    expect(selectDiscoveryCourses(library.items, "arts-humanities")).toHaveLength(2);
  });
  it("does not mistake catalog availability for started learning", () => {
    const library = buildLearningLibrary([course], {});
    expect(library.items).toHaveLength(1);
    expect(library.active).toEqual([]);
    expect(library.completed).toEqual([]);
    expect(library.completedSections).toBe(0);
  });

  it("keeps identical section IDs isolated by course", () => {
    const second = { ...course, key: "second" };
    const library = buildLearningLibrary([course, second], {
      first: { bookmark: null, progress: { completedSectionIds: ["one"], sectionStatuses: {} } },
    });
    expect(library.active.map((item) => item.course.key)).toEqual(["first"]);
    expect(library.items[1].progress.completed).toBe(0);
    expect(library.completedSections).toBe(1);
  });

  it("resolves valid bookmarks without trusting stale bookmark paths", () => {
    const library = buildLearningLibrary([course], {
      first: {
        progress: null,
        bookmark: { course_key: "first", section_id: "two", path: "/stale/path" },
      },
    });
    expect(library.active[0].bookmark?.title).toBe("Second section");
    const stale = buildLearningLibrary([course], {
      first: { progress: null, bookmark: { course_key: "first", section_id: "deleted" } },
    });
    expect(stale.active).toEqual([]);
  });

  it("counts completion against the current course structure, not stale IDs", () => {
    const library = buildLearningLibrary([course], {
      first: {
        bookmark: null,
        progress: { completedSectionIds: ["one", "two", "deleted"], sectionStatuses: {} },
      },
    });
    expect(library.active).toEqual([]);
    expect(library.completed).toHaveLength(1);
    expect(library.completedSections).toBe(2);
    expect(library.completed[0].progress.percentage).toBe(100);
  });

  it("omits empty, archived, and failed courses from learner discovery", () => {
    const empty = { ...course, key: "empty", data: { ...course.data, modules: [] } };
    const archived = { ...course, key: "archived", status: "archived" as const };
    const failed = { ...course, key: "failed", status: "failed" as const };
    expect(buildLearningLibrary([empty, archived, failed], {}).items).toEqual([]);
  });
});

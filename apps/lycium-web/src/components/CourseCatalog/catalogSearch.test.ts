import { describe, expect, it } from "vitest";
import type { CourseEntry } from "../../courseTypes";
import { getCourseSearchScore, normalizeSearchText } from "./catalogUtils";

const baseCourse: CourseEntry = {
  key: "local-test-course",
  title: "Software Engineering Foundations",
  source: "local",
  data: {
    title: "Software Engineering Foundations",
    shortDescription: "Project workflow, testing, and team delivery.",
    category: "college-engineering",
    department: "computer-science",
    tags: ["software", "testing"],
    modules: [
      {
        id: "module-1",
        title: "Module 1",
        sections: [{ id: "section-1", title: "Intro", content: [{ type: "text", value: "Hello" }] }],
      },
    ],
  },
};

describe("catalog search scoring", () => {
  it("weights title matches above tag and description matches", () => {
    const titleScore = getCourseSearchScore(baseCourse, normalizeSearchText("software"));
    const descriptionOnlyScore = getCourseSearchScore(
      {
        ...baseCourse,
        title: "Delivery Practice",
        data: {
          ...baseCourse.data,
          title: "Delivery Practice",
          tags: [],
          shortDescription: "Software teams use reviews and tests.",
        },
      },
      normalizeSearchText("software"),
    );

    expect(titleScore).toBeGreaterThan(descriptionOnlyScore);
  });

  it("includes tags in ranking signals", () => {
    expect(getCourseSearchScore(baseCourse, normalizeSearchText("testing"))).toBeGreaterThan(0);
  });
});

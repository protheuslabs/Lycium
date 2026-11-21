import { describe, expect, it } from "vitest";
import type { CourseEntry } from "../courseTypes";
import { courseAssessmentCounts, courseDurationLabel, courseLearningOutcomes, courseLevelLabel, sectionLearningType } from "./coursePresentation";

const course: CourseEntry = {
  key: "presentation", title: "Presentation fixture", source: "local",
  data: { title: "Presentation fixture", modules: [] },
};

describe("course presentation", () => {
  it("displays readable levels without inventing a default", () => {
    expect(courseLevelLabel(course)).toBeNull();
    expect(courseLevelLabel({ ...course, data: { ...course.data, difficultyLevel: "undergrad" } })).toBe("Undergraduate");
    expect(courseLevelLabel({ ...course, data: { ...course.data, difficultyLevel: "Introductory" } })).toBe("Introductory");
  });
  it("omits absent estimates instead of inventing effort from section count", () => {
    expect(courseDurationLabel(course)).toBeNull();
    expect(courseDurationLabel({ ...course, data: { ...course.data, estimatedMinutes: 25 } })).toBe("~25 min");
    expect(courseDurationLabel({ ...course, data: { ...course.data, estimatedHours: 1 } })).toBe("~1 hour");
    expect(courseDurationLabel({ ...course, data: { ...course.data, estimatedMinutes: 90 } })).toBe("~1.5 hours");
  });

  it("reads only explicit course outcomes, not private planning instructions", () => {
    const metadata = { courseTemplate: { learningOutcomes: ["Use evidence.", { outcome: "Explain a conclusion." }, { outcome: " Use evidence. " }, { description: "Write the lesson." }, null, " "] } };
    expect(courseLearningOutcomes({ ...course, data: { ...course.data, metadata } })).toEqual(["Use evidence.", "Explain a conclusion."]);
    expect(courseLearningOutcomes(course)).toEqual([]);
    expect(courseLearningOutcomes({ ...course, data: { ...course.data, metadata: { courseTemplate: { learningOutcomes: "bad shape" } } } })).toEqual([]);
  });

  it("counts real assessment blocks separately from unfilled assessment sections", () => {
    const sections = [
      { id: "mixed", title: "Practice", content: [{ type: "quiz" }, { type: "quiz" }, { type: "project" }] },
      { id: "empty", title: "Final", pageType: "apply" as const, content: [] },
      { id: "lesson", title: "Reading", content: [{ type: "text", value: "A lesson." }] },
    ];
    expect(courseAssessmentCounts({ ...course, data: { ...course.data, modules: [{ id: "one", title: "One", sections }] } })).toEqual({ quizzes: 2, projects: 1, assessments: 1 });
    expect(sectionLearningType(sections[2])).toBe("Lesson");
  });
});

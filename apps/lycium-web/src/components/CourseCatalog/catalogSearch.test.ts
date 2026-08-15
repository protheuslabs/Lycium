import { describe, expect, it } from "vitest";
import type { LyciumProgram } from "@lycium/contracts";
import type { CourseEntry } from "../../courseTypes";
import { getVisibleCatalogCourses } from "./catalogCourseFiltering";
import { getVisibleCatalogClusters, getVisibleCatalogPrograms } from "./catalogPathFiltering";
import { getCourseSearchScore, getGeneratingCourseTitle, normalizeSearchText } from "./catalogUtils";

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

const pathCourse: CourseEntry = {
  ...baseCourse,
  key: "local-path-course",
  title: "Path Course",
  data: {
    ...baseCourse.data,
    title: "Path Course",
    estimatedMinutes: 90,
  },
};

const pathProgram: LyciumProgram = {
  id: "test-path-program",
  title: "Test Path Program",
  description: "A generic test program fixture.",
  programType: "skill_path",
  field: "Test Field",
  level: "foundational",
  targetOutcome: "Validate catalog path behavior.",
  learningOutcomes: [{ id: "outcome-1", statement: "Use the path fixture." }],
  entryRequirements: [],
  requirementGroups: [
    {
      id: "cluster-1",
      displayName: "Cluster One",
      groupKind: "cluster",
      purpose: "Validate cluster behavior.",
      learningOutcomes: [{ id: "cluster-outcome-1", statement: "Complete a test course." }],
      requirements: [{ id: "requirement-1", title: "Complete path course", type: "complete_course", courseId: pathCourse.key }],
      completionRule: { type: "complete_all" },
      estimatedHours: 2,
    },
  ],
  estimatedHours: 2,
  masteryPolicy: {},
  version: "0.1.0",
  reviewStatus: "draft",
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

  it("can hide locked courses whose prerequisites are unmet", () => {
    const prerequisite: CourseEntry = {
      ...baseCourse,
      key: "local-prerequisite",
      title: "Prerequisite Course",
      data: { ...baseCourse.data, title: "Prerequisite Course", prerequisites: [] },
    };
    const lockedCourse: CourseEntry = {
      ...baseCourse,
      key: "local-locked-course",
      title: "Locked Course",
      data: {
        ...baseCourse.data,
        title: "Locked Course",
        prerequisites: [{ type: "course", courseId: prerequisite.key, title: prerequisite.title }],
      },
    };
    const courses = [prerequisite, lockedCourse];
    const catalogCourseMap = new Map(courses.map((course) => [course.key, course]));
    const visible = getVisibleCatalogCourses({
      activityFilter: "all",
      catalogCourseMap,
      collegeFilter: "all",
      courses,
      departmentFilter: "all",
      difficultyFilter: "all",
      isClusterScoped: false,
      searchQuery: "",
      selectedClusterCourseIds: new Set(),
      selectedClusterRequirementContexts: new Map(),
      showLockedCourses: false,
      sortMode: "college",
    });

    expect(visible.map(({ course }) => course.key)).not.toContain(lockedCourse.key);
  });

  it("pins local source-gated drafts above normal catalog sorting", () => {
    const sourceGatedDraft: CourseEntry = {
      ...baseCourse,
      key: "draft-needs-sources-test",
      title: "Zoology Source Gap Draft",
      source: "local",
      status: "needs_sources",
      data: {
        ...baseCourse.data,
        title: "Zoology Source Gap Draft",
        category: "natural-sciences-mathematics",
        department: "biology",
      },
    };
    const visible = getVisibleCatalogCourses({
      activityFilter: "all",
      catalogCourseMap: new Map([baseCourse, sourceGatedDraft].map((course) => [course.key, course])),
      collegeFilter: "all",
      courses: [baseCourse, sourceGatedDraft],
      departmentFilter: "all",
      difficultyFilter: "all",
      isClusterScoped: false,
      searchQuery: "",
      selectedClusterCourseIds: new Set(),
      selectedClusterRequirementContexts: new Map(),
      showLockedCourses: true,
      sortMode: "college",
    });

    expect(visible[0]?.course.key).toBe(sourceGatedDraft.key);
  });

  it("sorts programs and clusters through shared path sort rules", () => {
    const courses = [pathCourse];
    const courseMap = new Map(courses.map((course) => [course.key, course]));
    const programs = getVisibleCatalogPrograms({
      programs: [pathProgram],
      courses,
      courseMap,
      activityFilter: "all",
      collegeFilter: "all",
      departmentFilter: "all",
      difficultyFilter: "all",
      searchQuery: "",
      showLockedCourses: true,
      sortMode: "name",
    });
    const clusters = getVisibleCatalogClusters({
      program: pathProgram,
      courseMap,
      activityFilter: "all",
      collegeFilter: "all",
      departmentFilter: "all",
      difficultyFilter: "all",
      searchQuery: "",
      showLockedCourses: true,
      sortMode: "time-asc",
    });
    const clusterMinutes = clusters.map(({ estimate }) => estimate.minutes ?? Number.MAX_SAFE_INTEGER);

    expect(programs[0]?.program.id).toBe(pathProgram.id);
    expect(clusterMinutes).toEqual([...clusterMinutes].sort((a, b) => a - b));
  });
});

describe("generating course title", () => {
  it("uses a neutral placeholder before the agent has named the course", () => {
    expect(getGeneratingCourseTitle(null)).toBe("New Course");
    expect(getGeneratingCourseTitle("   ")).toBe("New Course");
  });

  it("uses the generated working title instead of the user prompt", () => {
    expect(getGeneratingCourseTitle("Principles of Macroeconomics")).toBe("Principles of Macroeconomics");
  });
});

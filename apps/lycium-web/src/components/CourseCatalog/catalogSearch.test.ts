import { describe, expect, it } from "vitest";
import type { CourseEntry } from "../../courseTypes";
import { localCourses } from "../../courseData/localCourses";
import { softwareEngineeringProgram } from "../../courseData/programs/softwareEngineeringProgram";
import { getVisibleCatalogCourses } from "./catalogCourseFiltering";
import { getVisibleCatalogClusters, getVisibleCatalogPrograms } from "./catalogPathFiltering";
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
      showLockedCourses: false,
      sortMode: "college",
    });

    expect(visible.map(({ course }) => course.key)).not.toContain(lockedCourse.key);
  });

  it("sorts programs and clusters through shared path sort rules", () => {
    const courseMap = new Map(localCourses.map((course) => [course.key, course]));
    const programs = getVisibleCatalogPrograms({
      programs: [softwareEngineeringProgram],
      courses: localCourses,
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
      program: softwareEngineeringProgram,
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

    expect(programs[0]?.program.id).toBe(softwareEngineeringProgram.id);
    expect(clusterMinutes).toEqual([...clusterMinutes].sort((a, b) => a - b));
  });
});

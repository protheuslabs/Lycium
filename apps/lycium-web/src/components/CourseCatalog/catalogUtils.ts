import type { CourseEntry } from "../../courseTypes";
import { getCourseDepartmentLabel, getCourseTagLabels } from "../../courseData/courseTaxonomy";
import { getBookmarkedModuleSection, getCourseProgress } from "../../utils/courseRouting";

export type CatalogSortMode = "college" | "completion-desc" | "completion-asc";
export type CatalogPathSortMode = "name" | "completion-desc" | "completion-asc" | "time-desc" | "time-asc";
export type CatalogActivityFilter = "all" | "not-started" | "in-progress" | "completed";
export type CatalogViewLevel = "programs" | "clusters" | "courses";

export type CatalogVisibleCourse = {
  course: CourseEntry;
  courseProgress: ReturnType<typeof getCourseProgress>;
  bookmarkedSection: ReturnType<typeof getBookmarkedModuleSection>;
  hasCourseActivity: boolean;
  isLocked: boolean;
  unmetPrerequisites: string[];
  collegeLabel: string;
  searchScore: number;
};

export const CATALOG_COURSE_CARD_MIN_WIDTH = 220;
export const CATALOG_DESKTOP_ROWS_PER_PAGE = 3;
export const CATALOG_MOBILE_ROWS_PER_PAGE = 4;

export const CATALOG_LEVEL_OPTIONS = [
  { value: "", label: "Any level" },
  { value: "elementary", label: "Elementary" },
  { value: "highschool", label: "High school" },
  { value: "undergrad", label: "Undergrad" },
  { value: "postgrad", label: "Post-grad" },
];

export const CATALOG_SORT_OPTIONS = [
  { value: "college", label: "Sort by Type" },
  { value: "completion-desc", label: "Sort by Completion ↑↓" },
  { value: "completion-asc", label: "Sort by Completion ↓↑" },
];

export const CATALOG_PATH_SORT_OPTIONS = [
  { value: "name", label: "Sort by Name" },
  { value: "completion-desc", label: "Sort by Completion ↑↓" },
  { value: "completion-asc", label: "Sort by Completion ↓↑" },
  { value: "time-desc", label: "Sort by Time ↑↓" },
  { value: "time-asc", label: "Sort by Time ↓↑" },
];

export const CATALOG_ACTIVITY_OPTIONS = [
  { value: "all", label: "Any progress" },
  { value: "not-started", label: "Not started" },
  { value: "in-progress", label: "In progress" },
  { value: "completed", label: "Completed" },
];

export function getGeneratingCourseTitle(prompt: string): string {
  const title = prompt
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  if (!title) {
    return "New course";
  }

  return title.length > 72 ? `${title.slice(0, 69)}...` : title;
}

export function normalizeSearchText(value: string): string {
  return value.trim().toLowerCase();
}

export function getCollegeFilterLabel(label: string): string {
  return label.replace(/^College of\s+/i, "");
}

function scoreSearchField(fieldValue: string | undefined, query: string, weight: number): number {
  const value = fieldValue?.toLowerCase() ?? "";

  if (!query || !value) {
    return 0;
  }

  if (value === query) {
    return weight * 4;
  }

  if (value.startsWith(query)) {
    return weight * 3;
  }

  if (value.includes(query)) {
    return weight * 2;
  }

  return 0;
}

export function getCourseSearchScore(course: CourseEntry, query: string): number {
  if (!query) {
    return 0;
  }

  const tagScore = [...(course.data.tags ?? []), ...getCourseTagLabels(course.data.tags)].reduce(
    (total, tag) => total + scoreSearchField(tag, query, 6),
    0,
  );
  const departmentScore = [
    course.data.department,
    course.data.department ? getCourseDepartmentLabel(course.data.category, course.data.department) : undefined,
    ...(course.data.courseEquivalencies ?? []).flatMap((equivalency) => [
      equivalency.department,
      equivalency.courseCode,
    ]),
  ].reduce((total, field) => total + scoreSearchField(field, query, 6), 0);
  const titleScore = scoreSearchField(course.title, query, 10) + scoreSearchField(course.data.title, query, 10);
  const descriptionScore = scoreSearchField(course.data.shortDescription, query, 2);

  return titleScore + tagScore + departmentScore + descriptionScore;
}

function compareCourseTitles(a: CourseEntry, b: CourseEntry): number {
  return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
}

export function compareCatalogSort(a: CatalogVisibleCourse, b: CatalogVisibleCourse, sortMode: CatalogSortMode): number {
  if (sortMode === "completion-desc") {
    return b.courseProgress.percentage - a.courseProgress.percentage || compareCourseTitles(a.course, b.course);
  }

  if (sortMode === "completion-asc") {
    return a.courseProgress.percentage - b.courseProgress.percentage || compareCourseTitles(a.course, b.course);
  }

  return (
    a.collegeLabel.localeCompare(b.collegeLabel, undefined, { sensitivity: "base" }) ||
    compareCourseTitles(a.course, b.course)
  );
}

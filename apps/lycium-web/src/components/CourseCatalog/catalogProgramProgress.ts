import type { LyciumProgram, LyciumRequirement, LyciumRequirementGroup } from "@lycium/contracts";
import type { CourseEntry } from "../../courseTypes";
import { getCourseProgress } from "../../utils/courseRouting";

export type CatalogPathProgress = {
  total: number;
  completed: number;
  viewed: number;
  percentage: number;
  viewedPercentage: number;
  hasProgress: boolean;
};
export type CatalogProgressCache = Map<string, ReturnType<typeof getCourseProgress>>;

export function requirementCourseIds(requirement: LyciumRequirement): string[] {
  if (requirement.type === "complete_course") return [requirement.courseId];
  if (requirement.type === "complete_n_of_courses") return requirement.courseIds;
  if (requirement.type === "requirement_set") return requirement.requirements.flatMap(requirementCourseIds);
  return [];
}

export function groupCourseIds(group: LyciumRequirementGroup): string[] {
  return Array.from(new Set(group.requirements.flatMap(requirementCourseIds)));
}

export function buildCatalogProgressCache(courseMap: Map<string, CourseEntry>): CatalogProgressCache {
  return new Map(Array.from(courseMap.values(), (course) => [course.key, getCourseProgress(course)]));
}

export function catalogPathProgress(
  courseIds: string[],
  courseMap: Map<string, CourseEntry>,
  progressCache?: CatalogProgressCache,
): CatalogPathProgress {
  const uniqueCourseIds = Array.from(new Set(courseIds));
  const courses = uniqueCourseIds.map((courseId) => courseMap.get(courseId)).filter((course): course is CourseEntry => Boolean(course));
  const total = courses.length;

  if (total === 0) {
    return { total: 0, completed: 0, viewed: 0, percentage: 0, viewedPercentage: 0, hasProgress: false };
  }

  const summaries = courses.map((course) => progressCache?.get(course.key) ?? getCourseProgress(course));
  const completed = summaries.filter((summary) => summary.percentage >= 100).length;
  const viewed = summaries.filter((summary) => summary.viewed > 0 || summary.completed > 0).length;

  return {
    total,
    completed,
    viewed,
    percentage: (completed / total) * 100,
    viewedPercentage: (viewed / total) * 100,
    hasProgress: viewed > 0 || completed > 0,
  };
}

export function programCourseIds(program: LyciumProgram): string[] {
  return Array.from(new Set(program.requirementGroups.flatMap(groupCourseIds)));
}

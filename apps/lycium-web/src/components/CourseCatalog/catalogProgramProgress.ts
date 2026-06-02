import type { LyciumProgram, LyciumRequirement, LyciumRequirementGroup } from "@lycium/contracts";
import type { CourseEntry } from "../../courseTypes";
import { getCourseProgress } from "../../utils/courseRouting";
import { getUnmetCoursePrerequisites } from "./catalogPrerequisites";

export type CatalogPathProgress = {
  total: number;
  completed: number;
  viewed: number;
  percentage: number;
  viewedPercentage: number;
  hasProgress: boolean;
};
export type CatalogPathContinuity = {
  totalRequirements: number;
  mappedRequirements: number;
  courseCount: number;
  availableCourseCount: number;
  lockedCourseCount: number;
  missingCourseCount: number;
  sourceCount: number;
  capstoneCount: number;
  nextLabel: string;
  hasGaps: boolean;
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

function leafRequirements(requirements: LyciumRequirement[]): LyciumRequirement[] {
  return requirements.flatMap((requirement) =>
    requirement.type === "requirement_set" ? leafRequirements(requirement.requirements) : [requirement],
  );
}

function requirementIsMapped(requirement: LyciumRequirement, courseMap: Map<string, CourseEntry>): boolean {
  if (requirement.type === "complete_course") return courseMap.has(requirement.courseId);
  if (requirement.type === "complete_n_of_courses") {
    return requirement.courseIds.filter((courseId) => courseMap.has(courseId)).length >= requirement.count;
  }
  if (requirement.type === "pass_assessment") return Boolean(requirement.assessmentId);
  if (requirement.type === "submit_project") return Boolean(requirement.projectId);
  if (requirement.type === "demonstrate_competency") return Boolean(requirement.competencyId);
  if (requirement.type === "earn_hours") return requirement.minimumHours > 0;
  return false;
}

function capstoneRequirementCount(requirements: LyciumRequirement[]): number {
  return requirements.reduce((total, requirement) => {
    if (requirement.type === "requirement_set") return total + capstoneRequirementCount(requirement.requirements);
    return total + (requirement.type === "submit_project" ? 1 : 0);
  }, 0);
}

function courseSourceIds(course: CourseEntry): string[] {
  const data = course.data as {
    sourceIds?: unknown;
    sourceRecords?: Array<{ id?: unknown }>;
  };
  const sourceIds = Array.isArray(data.sourceIds)
    ? data.sourceIds.filter((sourceId): sourceId is string => typeof sourceId === "string")
    : [];
  const sourceRecordIds = Array.isArray(data.sourceRecords)
    ? data.sourceRecords.map((source) => source.id).filter((sourceId): sourceId is string => typeof sourceId === "string")
    : [];
  return Array.from(new Set([...sourceIds, ...sourceRecordIds]));
}

function courseHasActivity(course: CourseEntry, progressCache?: CatalogProgressCache): boolean {
  const progress = progressCache?.get(course.key) ?? getCourseProgress(course);
  return progress.viewed > 0 || progress.completed > 0;
}

function courseIsLocked(course: CourseEntry, courseMap: Map<string, CourseEntry>, progressCache?: CatalogProgressCache): boolean {
  return !courseHasActivity(course, progressCache) && getUnmetCoursePrerequisites(course, courseMap).length > 0;
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

export function catalogPathContinuity(
  requirements: LyciumRequirement[],
  courseIds: string[],
  courseMap: Map<string, CourseEntry>,
  progressCache?: CatalogProgressCache,
): CatalogPathContinuity {
  const uniqueCourseIds = Array.from(new Set(courseIds));
  const leaves = leafRequirements(requirements).filter((requirement) => requirement.required !== false);
  const courses = uniqueCourseIds.map((courseId) => courseMap.get(courseId));
  const existingCourses = courses.filter((course): course is CourseEntry => Boolean(course));
  const lockedCourseCount = existingCourses.filter((course) => courseIsLocked(course, courseMap, progressCache)).length;
  const availableCourseCount = existingCourses.length - lockedCourseCount;
  const missingCourseCount = uniqueCourseIds.length - existingCourses.length;
  const sourceCount = new Set(existingCourses.flatMap(courseSourceIds)).size;
  const nextCourseId = uniqueCourseIds.find((courseId) => {
    const course = courseMap.get(courseId);
    if (!course) return true;
    const progress = progressCache?.get(course.key) ?? getCourseProgress(course);
    return progress.percentage < 100;
  });
  const nextCourse = nextCourseId ? courseMap.get(nextCourseId) : null;
  const nextLabel = nextCourse
    ? courseIsLocked(nextCourse, courseMap, progressCache)
      ? `Locked: ${nextCourse.title}`
      : `Up next: ${nextCourse.title}`
    : nextCourseId
      ? `Needs course: ${nextCourseId}`
      : "Path complete";

  return {
    totalRequirements: leaves.length,
    mappedRequirements: leaves.filter((requirement) => requirementIsMapped(requirement, courseMap)).length,
    courseCount: uniqueCourseIds.length,
    availableCourseCount,
    lockedCourseCount,
    missingCourseCount,
    sourceCount,
    capstoneCount: capstoneRequirementCount(requirements),
    nextLabel,
    hasGaps: missingCourseCount > 0 || lockedCourseCount > 0 || sourceCount === 0,
  };
}

export function programPathContinuity(
  program: LyciumProgram,
  courseMap: Map<string, CourseEntry>,
  progressCache?: CatalogProgressCache,
): CatalogPathContinuity {
  return catalogPathContinuity(
    program.requirementGroups.flatMap((group) => group.requirements),
    programCourseIds(program),
    courseMap,
    progressCache,
  );
}

export function groupPathContinuity(
  group: LyciumRequirementGroup,
  courseMap: Map<string, CourseEntry>,
  progressCache?: CatalogProgressCache,
): CatalogPathContinuity {
  return catalogPathContinuity(group.requirements, groupCourseIds(group), courseMap, progressCache);
}

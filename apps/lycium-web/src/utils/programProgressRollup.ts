import type { LyciumCompletionRule, LyciumProgram, LyciumRequirement, LyciumRequirementGroup } from "@lycium/contracts";
import type { CourseEntry } from "../courseTypes";
import { getCourseProgress } from "./courseRouting";

export type RequirementProgressStatus = "complete" | "in_progress" | "blocked" | "pending" | "missing";

export type RequirementProgressEvaluation = {
  status: RequirementProgressStatus;
  completedCount: number;
  targetCount: number;
  connectedCourseIds: string[];
  missingCourseIds: string[];
  evidenceIds: string[];
  benchmarkIds: string[];
};

export type ProgramProgressRollup = {
  total: number;
  completed: number;
  viewed: number;
  percentage: number;
  viewedPercentage: number;
  hasProgress: boolean;
  status: "not_started" | "in_progress" | "complete";
};

export type CourseProgressLookup = Map<string, ReturnType<typeof getCourseProgress>>;

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function progressForCourse(course: CourseEntry, progressLookup?: CourseProgressLookup) {
  return progressLookup?.get(course.key) ?? getCourseProgress(course);
}

function sourceIdsForCourse(course: CourseEntry | undefined): string[] {
  if (!course) return [];
  const topLevel = Array.isArray(course.data.sourceIds) ? course.data.sourceIds : [];
  const courseLevel = Array.isArray(course.data.sourceRecords) ? course.data.sourceRecords.map((source) => source.id) : [];
  return unique([...topLevel, ...courseLevel]);
}

export function leafRequirements(requirements: LyciumRequirement[]): LyciumRequirement[] {
  return requirements.flatMap((requirement) =>
    requirement.type === "requirement_set" ? leafRequirements(requirement.requirements) : [requirement],
  );
}

export function allRequirementNodes(requirements: LyciumRequirement[]): LyciumRequirement[] {
  return requirements.flatMap((requirement) =>
    requirement.type === "requirement_set" ? [requirement, ...allRequirementNodes(requirement.requirements)] : [requirement],
  );
}

export function requirementCourseIds(requirement: LyciumRequirement): string[] {
  if (requirement.type === "complete_course") return [requirement.courseId];
  if (requirement.type === "complete_n_of_courses") return requirement.courseIds;
  if (requirement.type === "requirement_set") return requirement.requirements.flatMap(requirementCourseIds);
  return [];
}

function requirementTarget(requirement: LyciumRequirement): number {
  if (requirement.type !== "requirement_set") return 1;
  if (requirement.operator === "n_of") return Math.max(1, requirement.count ?? 1);
  if (requirement.operator === "any") return 1;
  return Math.max(1, requirement.requirements.length);
}

function statusFromCounts(completed: number, viewed: number, target: number, missing: boolean): RequirementProgressStatus {
  if (completed >= target) return "complete";
  if (missing) return "missing";
  if (completed > 0 || viewed > 0) return "in_progress";
  return "pending";
}

export function evaluateRequirementProgress(
  requirement: LyciumRequirement,
  courseMap: Map<string, CourseEntry>,
  progressLookup?: CourseProgressLookup,
): RequirementProgressEvaluation {
  if (requirement.type === "requirement_set") {
    const nested = requirement.requirements.map((child) => evaluateRequirementProgress(child, courseMap, progressLookup));
    const targetCount = requirementTarget(requirement);
    const completedCount = nested.filter((row) => row.status === "complete").length;
    const viewedCount = nested.filter((row) => row.status === "complete" || row.status === "in_progress").length;
    const availableCount = nested.filter((row) => row.status !== "missing").length;

    return {
      status: statusFromCounts(completedCount, viewedCount, targetCount, availableCount < targetCount),
      completedCount,
      targetCount,
      connectedCourseIds: unique(nested.flatMap((row) => row.connectedCourseIds)),
      missingCourseIds: unique(nested.flatMap((row) => row.missingCourseIds)),
      evidenceIds: unique([...(requirement.origin?.evidenceRefs ?? []), ...nested.flatMap((row) => row.evidenceIds)]),
      benchmarkIds: unique([...(requirement.origin?.benchmarkIds ?? []), ...nested.flatMap((row) => row.benchmarkIds)]),
    };
  }

  const originEvidence = requirement.origin?.evidenceRefs ?? [];
  const benchmarkIds = requirement.origin?.benchmarkIds ?? [];

  if (requirement.type === "complete_course" || requirement.type === "complete_n_of_courses") {
    const courseIds = requirementCourseIds(requirement);
    const targetCount = requirement.type === "complete_n_of_courses" ? requirement.count : courseIds.length;
    const connectedCourses = courseIds.map((courseId) => courseMap.get(courseId)).filter((course): course is CourseEntry => Boolean(course));
    const missingCourseIds = courseIds.filter((courseId) => !courseMap.has(courseId));
    const completedCount = connectedCourses.filter((course) => progressForCourse(course, progressLookup).percentage >= 100).length;
    const viewedCount = connectedCourses.filter((course) => {
      const progress = progressForCourse(course, progressLookup);
      return progress.viewed > 0 || progress.completed > 0 || progress.percentage >= 100;
    }).length;
    const evidenceIds = unique([...originEvidence, ...connectedCourses.flatMap(sourceIdsForCourse)]);

    return {
      status: statusFromCounts(completedCount, viewedCount, Math.max(1, targetCount), connectedCourses.length < targetCount),
      completedCount,
      targetCount: Math.max(1, targetCount),
      connectedCourseIds: connectedCourses.map((course) => course.key),
      missingCourseIds,
      evidenceIds,
      benchmarkIds,
    };
  }

  return {
    status: "pending",
    completedCount: 0,
    targetCount: 1,
    connectedCourseIds: [],
    missingCourseIds: [],
    evidenceIds: unique(originEvidence),
    benchmarkIds: unique(benchmarkIds),
  };
}

function completionTarget(rule: LyciumCompletionRule, requiredRequirements: LyciumRequirement[]): number {
  if (rule.type === "complete_n_of") return Math.max(1, rule.count);
  if (rule.type === "complete_all") return Math.max(1, requiredRequirements.length);
  return 1;
}

export function rollupRequirementListProgress(
  requirements: LyciumRequirement[],
  completionRule: LyciumCompletionRule,
  courseMap: Map<string, CourseEntry>,
  progressLookup?: CourseProgressLookup,
): ProgramProgressRollup {
  const requiredRequirements = requirements.filter((requirement) => requirement.required !== false);
  const evaluations = requiredRequirements.map((requirement) => evaluateRequirementProgress(requirement, courseMap, progressLookup));
  const target = completionTarget(completionRule, requiredRequirements);
  const completed = Math.min(target, evaluations.filter((evaluation) => evaluation.status === "complete").length);
  const viewed = Math.min(
    target,
    evaluations.filter((evaluation) => evaluation.status === "complete" || evaluation.status === "in_progress").length,
  );
  const percentage = Math.round((completed / target) * 100);
  const viewedPercentage = Math.round((viewed / target) * 100);

  return {
    total: target,
    completed,
    viewed,
    percentage,
    viewedPercentage,
    hasProgress: completed > 0 || viewed > 0,
    status: completed >= target ? "complete" : completed > 0 || viewed > 0 ? "in_progress" : "not_started",
  };
}

export function rollupRequirementGroupProgress(
  group: LyciumRequirementGroup,
  courseMap: Map<string, CourseEntry>,
  progressLookup?: CourseProgressLookup,
): ProgramProgressRollup {
  return rollupRequirementListProgress(group.requirements, group.completionRule, courseMap, progressLookup);
}

export function rollupProgramProgress(
  program: LyciumProgram,
  courseMap: Map<string, CourseEntry>,
  progressLookup?: CourseProgressLookup,
): ProgramProgressRollup {
  const groupProgress = program.requirementGroups.map((group) => rollupRequirementGroupProgress(group, courseMap, progressLookup));
  const total = Math.max(1, groupProgress.length);
  const completed = groupProgress.filter((progress) => progress.status === "complete").length;
  const viewed = groupProgress.filter((progress) => progress.hasProgress).length;

  return {
    total,
    completed,
    viewed,
    percentage: Math.round((completed / total) * 100),
    viewedPercentage: Math.round((viewed / total) * 100),
    hasProgress: completed > 0 || viewed > 0,
    status: completed >= total ? "complete" : completed > 0 || viewed > 0 ? "in_progress" : "not_started",
  };
}

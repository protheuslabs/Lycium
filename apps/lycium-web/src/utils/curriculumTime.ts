import type { LyciumProgram, LyciumRequirement, LyciumRequirementGroup } from "@lycium/contracts";
import type { CourseEntry, CourseSection } from "../courseTypes";

export type TimeEstimateSource = "derived" | "authored" | "mixed" | "missing";

export type TimeEstimate = {
  minutes: number | null;
  source: TimeEstimateSource;
  coverage: number;
  estimatedChildren: number;
  totalChildren: number;
  authoredMinutes?: number | null;
};

type EstimableCourseData = CourseEntry["data"] & {
  estimatedMinutes?: number;
  estimatedHours?: number;
  metadata?: CourseEntry["data"]["metadata"] & {
    estimatedMinutes?: unknown;
    estimatedHours?: unknown;
  };
};

type EstimableSection = CourseSection & {
  estimatedMinutes?: number;
  estimatedHours?: number;
};

function finitePositiveNumber(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function minutesFromHours(value: unknown): number | null {
  const hours = finitePositiveNumber(value);
  return hours === null ? null : Math.round(hours * 60);
}

function estimateFromAuthoredMinutes(minutes: number | null, fallbackChildren = 0): TimeEstimate {
  return minutes === null
    ? { minutes: null, source: "missing", coverage: 0, estimatedChildren: 0, totalChildren: fallbackChildren, authoredMinutes: null }
    : { minutes, source: "authored", coverage: fallbackChildren ? 0 : 1, estimatedChildren: 0, totalChildren: fallbackChildren, authoredMinutes: minutes };
}

function withFallback(children: TimeEstimate[], authoredMinutes: number | null, derive: (known: TimeEstimate[]) => number | null): TimeEstimate {
  const totalChildren = children.length;
  const known = children.filter((child) => child.minutes !== null);
  const coverage = totalChildren ? known.length / totalChildren : 0;
  const derivedMinutes = totalChildren > 0 && known.length === totalChildren ? derive(known) : null;

  if (derivedMinutes !== null) {
    return {
      minutes: derivedMinutes,
      source: "derived",
      coverage: 1,
      estimatedChildren: known.length,
      totalChildren,
      authoredMinutes,
    };
  }

  if (authoredMinutes !== null) {
    return {
      minutes: authoredMinutes,
      source: known.length > 0 ? "mixed" : "authored",
      coverage,
      estimatedChildren: known.length,
      totalChildren,
      authoredMinutes,
    };
  }

  return {
    minutes: null,
    source: "missing",
    coverage,
    estimatedChildren: known.length,
    totalChildren,
    authoredMinutes: null,
  };
}

function sumEstimates(estimates: TimeEstimate[]): number | null {
  return estimates.reduce((sum, estimate) => sum + (estimate.minutes ?? 0), 0);
}

function lowestNEstimates(estimates: TimeEstimate[], count: number): number | null {
  if (count < 1 || estimates.length < count) return null;
  return estimates
    .map((estimate) => estimate.minutes)
    .filter((minutes): minutes is number => minutes !== null)
    .sort((a, b) => a - b)
    .slice(0, count)
    .reduce((sum, minutes) => sum + minutes, 0);
}

function authoredCourseMinutes(course: CourseEntry): number | null {
  const data = course.data as EstimableCourseData;
  return (
    finitePositiveNumber(data.estimatedMinutes) ??
    minutesFromHours(data.estimatedHours) ??
    finitePositiveNumber(data.metadata?.estimatedMinutes) ??
    minutesFromHours(data.metadata?.estimatedHours)
  );
}

function authoredRequirementMinutes(requirement: LyciumRequirement): number | null {
  if (requirement.type === "earn_hours") return minutesFromHours(requirement.minimumHours);
  return minutesFromHours(requirement.estimatedHours);
}

function authoredGroupMinutes(group: LyciumRequirementGroup): number | null {
  return minutesFromHours(group.estimatedHours);
}

function authoredProgramMinutes(program: LyciumProgram): number | null {
  return minutesFromHours(program.estimatedHours);
}

export function estimateSectionTime(section: CourseSection): TimeEstimate {
  const estimable = section as EstimableSection;
  return estimateFromAuthoredMinutes(
    finitePositiveNumber(estimable.estimatedMinutes) ?? minutesFromHours(estimable.estimatedHours),
  );
}

export function estimateCourseTime(course: CourseEntry): TimeEstimate {
  const sections = course.data.modules.flatMap((module) => module.sections);
  const sectionEstimates = sections.map(estimateSectionTime);
  return withFallback(sectionEstimates, authoredCourseMinutes(course), sumEstimates);
}

export function estimateRequirementTime(requirement: LyciumRequirement, courseMap: Map<string, CourseEntry>): TimeEstimate {
  if (requirement.type === "complete_course") {
    const course = courseMap.get(requirement.courseId);
    return course ? withFallback([estimateCourseTime(course)], authoredRequirementMinutes(requirement), sumEstimates) : estimateFromAuthoredMinutes(authoredRequirementMinutes(requirement), 1);
  }

  if (requirement.type === "complete_n_of_courses") {
    const courseEstimates = requirement.courseIds.map((courseId) => {
      const course = courseMap.get(courseId);
      return course ? estimateCourseTime(course) : estimateFromAuthoredMinutes(null, 1);
    });
    return withFallback(courseEstimates, authoredRequirementMinutes(requirement), (known) => lowestNEstimates(known, requirement.count));
  }

  if (requirement.type === "requirement_set") {
    const nested = requirement.requirements.map((child) => estimateRequirementTime(child, courseMap));
    const count = requirement.operator === "n_of" ? requirement.count ?? 1 : requirement.operator === "any" ? 1 : nested.length;
    return withFallback(
      nested,
      authoredRequirementMinutes(requirement),
      requirement.operator === "all" ? sumEstimates : (known) => lowestNEstimates(known, count),
    );
  }

  return estimateFromAuthoredMinutes(authoredRequirementMinutes(requirement));
}

export function estimateRequirementGroupTime(group: LyciumRequirementGroup, courseMap: Map<string, CourseEntry>): TimeEstimate {
  const requirements = group.requirements.filter((requirement) => requirement.required !== false);
  const requirementEstimates = requirements.map((requirement) => estimateRequirementTime(requirement, courseMap));
  const count = group.completionRule.type === "complete_n_of" ? group.completionRule.count : requirements.length;
  return withFallback(
    requirementEstimates,
    authoredGroupMinutes(group),
    group.completionRule.type === "complete_n_of" ? (known) => lowestNEstimates(known, count) : sumEstimates,
  );
}

export function estimateProgramTime(program: LyciumProgram, courses: CourseEntry[]): TimeEstimate {
  const courseMap = new Map(courses.map((course) => [course.key, course]));
  const groupEstimates = program.requirementGroups.map((group) => estimateRequirementGroupTime(group, courseMap));
  return withFallback(groupEstimates, authoredProgramMinutes(program), sumEstimates);
}

export function formatTimeEstimate(estimate: TimeEstimate): string {
  if (estimate.minutes === null) return "Time estimate missing";
  const hours = estimate.minutes / 60;
  const roundedHours = hours >= 10 ? Math.round(hours) : Math.round(hours * 10) / 10;
  return `~${roundedHours} hours`;
}

export function timeEstimateSourceLabel(estimate: TimeEstimate): string {
  if (estimate.source === "derived") return "derived";
  if (estimate.source === "mixed") return "mixed estimate";
  if (estimate.source === "authored") return "authored estimate";
  return "missing estimate";
}

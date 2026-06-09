import type { LyciumRequirement } from "@lycium/contracts";
import type { CourseEntry } from "../../courseTypes";
import { getCourseLifecycleSummary } from "../../utils/courseLifecycle";
import { sourceGapSummary } from "../../utils/courseSourceGaps";
import { getCourseProgress } from "../../utils/courseRouting";
import { leafRequirements, requirementCourseIds } from "../../utils/programProgressRollup";
import { getUnmetCoursePrerequisites } from "./catalogPrerequisites";
import type { CatalogProgressCache } from "./catalogProgramProgress";

export type CatalogPathReadinessStatus =
  | "ready"
  | "needs_sources"
  | "needs_evidence"
  | "missing_courses"
  | "locked"
  | "needs_review";

export type CatalogPathReadiness = {
  status: CatalogPathReadinessStatus;
  totalRequirements: number;
  mappedRequirements: number;
  courseCount: number;
  missingCourseCount: number;
  lockedCourseCount: number;
  sourceBlockedCourseCount: number;
  evidenceMissingCourseCount: number;
  reviewCourseCount: number;
  publishedCourseCount: number;
  sourceGapCount: number;
  sourceSlotCount: number;
  backedSourceSlotCount: number;
  sourceEvidenceCount: number;
  summaryLabel: string;
  nextActionLabel: string;
  hasBlockingIssue: boolean;
};

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function courseSources(course: CourseEntry): string[] {
  const sourceIds = Array.isArray(course.data.sourceIds) ? course.data.sourceIds : [];
  const sourceRecordIds = Array.isArray(course.data.sourceRecords)
    ? course.data.sourceRecords.map((source) => source.id).filter((id): id is string => Boolean(id))
    : [];
  return unique([...sourceIds, ...sourceRecordIds]);
}

function sourceSlotCounts(course: CourseEntry): { total: number; backed: number } {
  const sourceSlots = course.data.metadata?.sourceSlots ?? [];
  if (!Array.isArray(sourceSlots)) return { total: 0, backed: 0 };
  return {
    total: sourceSlots.length,
    backed: sourceSlots.filter((slot) => Boolean(slot.primarySourceId)).length,
  };
}

function courseIsLocked(course: CourseEntry, courseMap: Map<string, CourseEntry>, progressCache?: CatalogProgressCache): boolean {
  const progress = progressCache?.get(course.key) ?? getCourseProgress(course);
  return progress.viewed === 0 && progress.completed === 0 && getUnmetCoursePrerequisites(course, courseMap).length > 0;
}

function mappedRequirementCount(requirements: LyciumRequirement[], courseMap: Map<string, CourseEntry>): number {
  return leafRequirements(requirements)
    .filter((requirement) => requirement.required !== false)
    .filter((requirement) => {
      const courseIds = requirementCourseIds(requirement);
      if (courseIds.length === 0) return true;
      if (requirement.type === "complete_n_of_courses") {
        return courseIds.filter((courseId) => courseMap.has(courseId)).length >= requirement.count;
      }
      return courseIds.every((courseId) => courseMap.has(courseId));
    }).length;
}

function readinessStatus(input: {
  missingCourseCount: number;
  sourceBlockedCourseCount: number;
  evidenceMissingCourseCount: number;
  lockedCourseCount: number;
  reviewCourseCount: number;
}): CatalogPathReadinessStatus {
  if (input.missingCourseCount > 0) return "missing_courses";
  if (input.sourceBlockedCourseCount > 0) return "needs_sources";
  if (input.evidenceMissingCourseCount > 0) return "needs_evidence";
  if (input.lockedCourseCount > 0) return "locked";
  if (input.reviewCourseCount > 0) return "needs_review";
  return "ready";
}

function summaryForStatus(status: CatalogPathReadinessStatus): string {
  if (status === "missing_courses") return "Needs course shells";
  if (status === "needs_sources") return "Needs sources";
  if (status === "needs_evidence") return "Needs evidence";
  if (status === "locked") return "Prereqs locked";
  if (status === "needs_review") return "Review needed";
  return "Ready path";
}

function nextActionForStatus(status: CatalogPathReadinessStatus, counts: {
  missingCourseCount: number;
  sourceBlockedCourseCount: number;
  evidenceMissingCourseCount: number;
  lockedCourseCount: number;
  reviewCourseCount: number;
}): string {
  if (status === "missing_courses") return `Create ${counts.missingCourseCount} course shell${counts.missingCourseCount === 1 ? "" : "s"}`;
  if (status === "needs_sources") return `Add sources to ${counts.sourceBlockedCourseCount} course${counts.sourceBlockedCourseCount === 1 ? "" : "s"}`;
  if (status === "needs_evidence") return `Attach evidence to ${counts.evidenceMissingCourseCount} course${counts.evidenceMissingCourseCount === 1 ? "" : "s"}`;
  if (status === "locked") return `Unlock ${counts.lockedCourseCount} prerequisite gate${counts.lockedCourseCount === 1 ? "" : "s"}`;
  if (status === "needs_review") return `Review ${counts.reviewCourseCount} generated draft${counts.reviewCourseCount === 1 ? "" : "s"}`;
  return "Continue learning";
}

export function summarizeCatalogPathReadiness(
  requirements: LyciumRequirement[],
  courseIds: string[],
  courseMap: Map<string, CourseEntry>,
  progressCache?: CatalogProgressCache,
): CatalogPathReadiness {
  const uniqueCourseIds = unique(courseIds);
  const courses = uniqueCourseIds.map((courseId) => courseMap.get(courseId)).filter((course): course is CourseEntry => Boolean(course));
  const missingCourseCount = uniqueCourseIds.length - courses.length;
  const leaves = leafRequirements(requirements).filter((requirement) => requirement.required !== false);
  const sourceSummaries = courses.map((course) => sourceGapSummary(course));
  const lifecycles = courses.map((course) => getCourseLifecycleSummary(course));
  const sourceBlockedCourseCount = lifecycles.filter((lifecycle) => lifecycle.needsSourceInput).length;
  const evidenceMissingCourseCount = courses.filter((course, index) => {
    if (lifecycles[index].needsSourceInput) return false;
    return courseSources(course).length === 0 || sourceSummaries[index].conceptCoveragePercent < 70;
  }).length;
  const lockedCourseCount = courses.filter((course) => courseIsLocked(course, courseMap, progressCache)).length;
  const reviewCourseCount = lifecycles.filter((lifecycle) => lifecycle.isPublishCandidate).length;
  const publishedCourseCount = lifecycles.filter((lifecycle) => lifecycle.status === "published").length;
  const slotCountsByCourse = courses.map(sourceSlotCounts);
  const status = readinessStatus({
    missingCourseCount,
    sourceBlockedCourseCount,
    evidenceMissingCourseCount,
    lockedCourseCount,
    reviewCourseCount,
  });

  return {
    status,
    totalRequirements: leaves.length,
    mappedRequirements: mappedRequirementCount(requirements, courseMap),
    courseCount: uniqueCourseIds.length,
    missingCourseCount,
    lockedCourseCount,
    sourceBlockedCourseCount,
    evidenceMissingCourseCount,
    reviewCourseCount,
    publishedCourseCount,
    sourceGapCount: sourceSummaries.reduce((total, summary) => total + summary.blockingGaps.length, 0),
    sourceSlotCount: slotCountsByCourse.reduce((total, counts) => total + counts.total, 0),
    backedSourceSlotCount: slotCountsByCourse.reduce((total, counts) => total + counts.backed, 0),
    sourceEvidenceCount: new Set(courses.flatMap(courseSources)).size,
    summaryLabel: summaryForStatus(status),
    nextActionLabel: nextActionForStatus(status, {
      missingCourseCount,
      sourceBlockedCourseCount,
      evidenceMissingCourseCount,
      lockedCourseCount,
      reviewCourseCount,
    }),
    hasBlockingIssue: status !== "ready" && status !== "needs_review",
  };
}

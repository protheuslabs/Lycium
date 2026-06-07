import type { LyciumCourseGenerationGateResult, LyciumCourseQualityReport } from "@lycium/contracts";
import type { CourseEntry } from "../courseTypes";
import { hasBlockingSourceGaps } from "./courseSourceGaps";

export type CourseLifecycleTone =
  | "draft"
  | "source"
  | "review"
  | "revision"
  | "published"
  | "failed"
  | "archived";

export type CourseLifecycleSummary = {
  status: NonNullable<CourseEntry["status"]>;
  label: string;
  badgeLabel: string;
  description: string;
  actionLabel: string;
  tone: CourseLifecycleTone;
  canOpen: boolean;
  canPublish: boolean;
  isPublishCandidate: boolean;
  isReviewable: boolean;
  needsSourceInput: boolean;
  failedGateCount: number;
  needsReviewGateCount: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

export function getCourseQualityReport(course: CourseEntry): LyciumCourseQualityReport | null {
  if (isRecord(course.qualityReport)) {
    return course.qualityReport as LyciumCourseQualityReport;
  }
  const trace = isRecord(course.generation_trace) ? course.generation_trace : {};
  return isRecord(trace.quality_report) ? (trace.quality_report as LyciumCourseQualityReport) : null;
}

export function getCourseGenerationGates(course: CourseEntry): LyciumCourseGenerationGateResult[] {
  const qualityReport = getCourseQualityReport(course);
  const gates = qualityReport?.workflow?.gates;
  return Array.isArray(gates) ? gates : [];
}

export function getCourseLifecycleSummary(course: CourseEntry): CourseLifecycleSummary {
  const status = course.status ?? (course.source === "local" ? "draft" : "published");
  const sourceBlocked = hasBlockingSourceGaps(course);
  const gates = getCourseGenerationGates(course);
  const failedGateCount = gates.filter((gate) => gate.status === "failed").length;
  const needsReviewGateCount = gates.filter((gate) => gate.status === "needs_review").length;
  const qualityReport = getCourseQualityReport(course);
  const canPublish = status === "ready_for_review" && Boolean(qualityReport?.passed) && failedGateCount === 0;

  if (sourceBlocked) {
    return {
      status: "needs_sources",
      label: "Needs sources",
      badgeLabel: "Needs sources",
      description: "Course generation is paused until source coverage is strong enough.",
      actionLabel: "Add sources",
      tone: "source",
      canOpen: false,
      canPublish: false,
      isPublishCandidate: false,
      isReviewable: true,
      needsSourceInput: true,
      failedGateCount,
      needsReviewGateCount,
    };
  }

  if (status === "ready_for_review") {
    return {
      status,
      label: canPublish ? "Publish ready" : "Review blocked",
      badgeLabel: canPublish ? "Publish ready" : "Review blocked",
      description: canPublish
        ? "Quality gates passed and the course can be published."
        : "Review evidence is attached, but one or more gates still need attention.",
      actionLabel: canPublish ? "Review and publish" : "Review gates",
      tone: canPublish ? "review" : "revision",
      canOpen: true,
      canPublish,
      isPublishCandidate: true,
      isReviewable: true,
      needsSourceInput: false,
      failedGateCount,
      needsReviewGateCount,
    };
  }

  if (status === "needs_revision") {
    return {
      status,
      label: "Needs revision",
      badgeLabel: "Needs revision",
      description: "Generation produced a course, but review gates require changes before publishing.",
      actionLabel: "Review issues",
      tone: "revision",
      canOpen: true,
      canPublish: false,
      isPublishCandidate: true,
      isReviewable: true,
      needsSourceInput: false,
      failedGateCount,
      needsReviewGateCount,
    };
  }

  if (status === "published") {
    return {
      status,
      label: "Published",
      badgeLabel: "Published",
      description: "This course passed review and is available in the catalog.",
      actionLabel: "Open course",
      tone: "published",
      canOpen: true,
      canPublish: false,
      isPublishCandidate: false,
      isReviewable: Boolean(qualityReport),
      needsSourceInput: false,
      failedGateCount,
      needsReviewGateCount,
    };
  }

  if (status === "failed") {
    return {
      status,
      label: "Generation failed",
      badgeLabel: "Failed",
      description: "Generation stopped before producing a reviewable course.",
      actionLabel: "Review failure",
      tone: "failed",
      canOpen: false,
      canPublish: false,
      isPublishCandidate: false,
      isReviewable: Boolean(qualityReport),
      needsSourceInput: false,
      failedGateCount,
      needsReviewGateCount,
    };
  }

  if (status === "archived") {
    return {
      status,
      label: "Archived",
      badgeLabel: "Archived",
      description: "This course snapshot is retained for recordkeeping but is not active.",
      actionLabel: "View info",
      tone: "archived",
      canOpen: false,
      canPublish: false,
      isPublishCandidate: false,
      isReviewable: Boolean(qualityReport),
      needsSourceInput: false,
      failedGateCount,
      needsReviewGateCount,
    };
  }

  if (status === "generated" || status === "validating") {
    return {
      status,
      label: status === "validating" ? "Validating" : "Generated draft",
      badgeLabel: status === "validating" ? "Validating" : "Generated draft",
      description: "Generated content exists and should be reviewed before publishing.",
      actionLabel: "Review draft",
      tone: "draft",
      canOpen: true,
      canPublish: false,
      isPublishCandidate: true,
      isReviewable: true,
      needsSourceInput: false,
      failedGateCount,
      needsReviewGateCount,
    };
  }

  return {
    status: "draft",
    label: "Draft",
    badgeLabel: "Draft",
    description: "Editable local draft that has not been published.",
    actionLabel: "Open draft",
    tone: "draft",
    canOpen: true,
    canPublish: false,
    isPublishCandidate: false,
    isReviewable: Boolean(qualityReport),
    needsSourceInput: false,
    failedGateCount,
    needsReviewGateCount,
  };
}

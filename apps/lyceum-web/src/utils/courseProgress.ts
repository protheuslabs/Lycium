import type { CourseProgressRecord, SectionStatus } from "../courseTypes";

type ProgressSectionRef = string | { id: string };

export type CourseProgressSummary = {
  completed: number;
  total: number;
  percentage: number;
  viewed: number;
  viewedPercentage: number;
};

export const VALID_SECTION_STATUSES: SectionStatus[] = ["completed", "locked", "seen", "timed"];
const VIEWED_SECTION_STATUSES: SectionStatus[] = ["completed", "seen", "timed"];

export const DEFAULT_PROGRESS: CourseProgressRecord = {
  completedSectionIds: [],
  sectionStatuses: {},
};

export function isViewedSectionStatus(status: SectionStatus | undefined): boolean {
  return Boolean(status && VIEWED_SECTION_STATUSES.includes(status));
}

export function normalizeCompletedSectionIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0))
  );
}

export function normalizeSectionStatuses(value: unknown): Record<string, SectionStatus> {
  if (!value || typeof value !== "object") {
    return {};
  }

  const entries = Object.entries(value as Record<string, unknown>);
  const next: Record<string, SectionStatus> = {};

  for (const [sectionId, statusValue] of entries) {
    if (typeof sectionId !== "string" || sectionId.trim().length === 0 || typeof statusValue !== "string") {
      continue;
    }
    if (VALID_SECTION_STATUSES.includes(statusValue as SectionStatus)) {
      next[sectionId] = statusValue as SectionStatus;
    }
  }

  return next;
}

export function normalizeProgressRecord(value: unknown): CourseProgressRecord {
  if (!value || typeof value !== "object") {
    return DEFAULT_PROGRESS;
  }

  const payload = value as Record<string, unknown>;
  const completedSectionIds = normalizeCompletedSectionIds(payload.completedSectionIds ?? payload.completed_section_ids);
  const sectionStatuses = normalizeSectionStatuses(payload.sectionStatuses ?? payload.section_statuses);

  for (const sectionId of completedSectionIds) {
    sectionStatuses[sectionId] = "completed";
  }

  return {
    completedSectionIds,
    sectionStatuses,
  };
}

export function areSectionStatusMapsEqual(
  a: Record<string, SectionStatus>,
  b: Record<string, SectionStatus>
): boolean {
  const aEntries = Object.entries(a);
  const bEntries = Object.entries(b);

  if (aEntries.length !== bEntries.length) {
    return false;
  }

  for (const [sectionId, status] of aEntries) {
    if (b[sectionId] !== status) {
      return false;
    }
  }

  return true;
}

export function areProgressRecordsEqual(a: CourseProgressRecord, b: CourseProgressRecord): boolean {
  if (a.completedSectionIds.length !== b.completedSectionIds.length) {
    return false;
  }

  const aCompleted = new Set(a.completedSectionIds);
  for (const sectionId of b.completedSectionIds) {
    if (!aCompleted.has(sectionId)) {
      return false;
    }
  }

  return areSectionStatusMapsEqual(a.sectionStatuses, b.sectionStatuses);
}

/**
 * Resolves persisted statuses against the current course structure.
 * Locked status is derived from course ordering rules, not trusted from stale storage.
 */
export function resolveSectionStatuses(
  sections: Array<{ id: string }>,
  completedSectionIds: string[],
  sectionStatuses: Record<string, SectionStatus>,
  orderMandatory: boolean
): Record<string, SectionStatus> {
  const completedSet = new Set(completedSectionIds);
  const resolvedStatuses: Record<string, SectionStatus> = {};
  let hasIncompletePriorSection = false;

  for (const section of sections) {
    const sectionId = section.id;

    if (completedSet.has(sectionId)) {
      resolvedStatuses[sectionId] = "completed";
    } else if (orderMandatory && hasIncompletePriorSection) {
      resolvedStatuses[sectionId] = "locked";
    } else {
      const storedStatus = sectionStatuses[sectionId];
      if (storedStatus === "timed" || storedStatus === "seen") {
        resolvedStatuses[sectionId] = storedStatus;
      }
    }

    if (!completedSet.has(sectionId)) {
      hasIncompletePriorSection = true;
    }
  }

  return resolvedStatuses;
}

function getProgressSectionId(section: ProgressSectionRef): string {
  return typeof section === "string" ? section : section.id;
}

export function summarizeCourseProgress(
  sections: ProgressSectionRef[],
  progress: CourseProgressRecord
): CourseProgressSummary {
  const sectionIds = sections.map(getProgressSectionId);
  const total = sectionIds.length;

  if (total === 0) {
    return { completed: 0, total: 0, percentage: 0, viewed: 0, viewedPercentage: 0 };
  }

  const completedSet = new Set(progress.completedSectionIds);
  const completed = sectionIds.filter(
    (sectionId) => completedSet.has(sectionId) || progress.sectionStatuses[sectionId] === "completed"
  ).length;
  const viewed = sectionIds.filter(
    (sectionId) => completedSet.has(sectionId) || isViewedSectionStatus(progress.sectionStatuses[sectionId])
  ).length;

  return {
    completed,
    total,
    percentage: (completed / total) * 100,
    viewed,
    viewedPercentage: (viewed / total) * 100,
  };
}

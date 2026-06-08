import { createBrowserStorageRepository } from "@lycium/data-access";
import type { LyciumCourseEditHistoryEntry } from "@lycium/contracts";
import type { CourseEntry } from "../courseTypes";

const browserStorage = createBrowserStorageRepository();

export type LocalCourseDraftMetadata = {
  isLocalDraft: true;
  schemaVersion: 1;
  draftId: string;
  origin: "fork" | "local_edit" | "import";
  parentCourseKey?: string;
  parentCourseTitle?: string;
  forkedFromTitle?: string;
  conflictOfCourseKey?: string;
  conflictOfDraftId?: string;
  conflictReason?: "newer_revision" | "newer_timestamp";
  createdAt: string;
  updatedAt: string;
  revision: number;
};

export type LocalCourseDraftSaveResult = {
  course: CourseEntry;
  conflictDetected: boolean;
  persistedCourse?: CourseEntry;
  conflictReason?: LocalCourseDraftMetadata["conflictReason"];
};

export type LocalCourseDraftExportEnvelope = {
  kind: "lycium.localCourseDraft";
  schemaVersion: 1;
  exportedAt: string;
  course: CourseEntry;
};

function metadataRecord(course: CourseEntry): Record<string, unknown> {
  return (course.data.metadata ?? {}) as Record<string, unknown>;
}

function baseForkTitle(course: CourseEntry): string {
  const draft = getLocalDraftMetadata(course);
  return draft?.forkedFromTitle ?? course.title.replace(/^Fork of\s+/i, "");
}

function isEditHistoryEntry(entry: unknown): entry is LyciumCourseEditHistoryEntry {
  if (!entry || typeof entry !== "object") {
    return false;
  }
  const record = entry as Record<string, unknown>;
  const validationState = record.validationState;

  return (
    typeof record.operationType === "string" &&
    (validationState === undefined ||
      validationState === "unchecked" ||
      validationState === "valid" ||
      validationState === "invalid")
  );
}

function readEditHistory(metadata: CourseEntry["data"]["metadata"]): LyciumCourseEditHistoryEntry[] {
  const rawHistory = (metadata as Record<string, unknown> | undefined)?.editHistory;
  return Array.isArray(rawHistory) ? rawHistory.filter(isEditHistoryEntry) : [];
}

function draftConflictReason(
  persistedCourse: CourseEntry,
  editedCourse: CourseEntry,
): LocalCourseDraftMetadata["conflictReason"] | null {
  const persistedDraft = getLocalDraftMetadata(persistedCourse);
  const editedDraft = getLocalDraftMetadata(editedCourse);

  if (!persistedDraft || !editedDraft || persistedDraft.draftId !== editedDraft.draftId) {
    return null;
  }

  if (persistedDraft.revision > editedDraft.revision) {
    return "newer_revision";
  }

  const persistedUpdatedAt = Date.parse(persistedDraft.updatedAt);
  const editedUpdatedAt = Date.parse(editedDraft.updatedAt);
  if (
    persistedDraft.revision === editedDraft.revision &&
    Number.isFinite(persistedUpdatedAt) &&
    Number.isFinite(editedUpdatedAt) &&
    persistedUpdatedAt > editedUpdatedAt
  ) {
    return "newer_timestamp";
  }

  return null;
}

function createConflictDraft(
  course: CourseEntry,
  data: CourseEntry["data"],
  persistedCourse: CourseEntry,
  conflictReason: LocalCourseDraftMetadata["conflictReason"],
): CourseEntry {
  const conflictStamp = Date.now().toString(36);
  const savedCourse = markLocalDraftSaved(course, data);
  const savedDraft = getLocalDraftMetadata(savedCourse);
  const persistedDraft = getLocalDraftMetadata(persistedCourse);
  const conflictTitle = `${savedCourse.title} (conflict copy)`;

  return {
    ...savedCourse,
    key: `${course.key}-conflict-${conflictStamp}`,
    title: conflictTitle,
    data: {
      ...savedCourse.data,
      title: conflictTitle,
      metadata: {
        ...(savedCourse.data.metadata ?? {}),
        localDraft: savedDraft
          ? {
              ...savedDraft,
              draftId: `${savedDraft.draftId}-conflict-${conflictStamp}`,
              conflictOfCourseKey: persistedCourse.key,
              conflictOfDraftId: persistedDraft?.draftId,
              conflictReason,
            }
          : undefined,
      },
    },
  };
}

function comparableDraftData(data: CourseEntry["data"]) {
  const metadata = { ...(data.metadata ?? {}) } as Record<string, unknown>;
  delete metadata.localDraft;
  delete metadata.editHistory;

  return JSON.stringify({
    ...data,
    metadata,
  });
}

function hasSameDraftContent(persistedCourse: CourseEntry, data: CourseEntry["data"]) {
  return comparableDraftData(persistedCourse.data) === comparableDraftData(data);
}

function isCourseEntryCandidate(value: unknown): value is CourseEntry {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  const data = record.data as Record<string, unknown> | undefined;

  return (
    typeof record.key === "string" &&
    typeof record.title === "string" &&
    Boolean(data) &&
    typeof data?.title === "string" &&
    Array.isArray(data?.modules)
  );
}

export function readPersistedLocalCourseEntries(): CourseEntry[] {
  return browserStorage.readLocalCourseDrafts().map((course): CourseEntry => ({ ...course, source: "local" }));
}

export function mergeCourseEntriesByKey(priorityCourses: CourseEntry[], fallbackCourses: CourseEntry[]): CourseEntry[] {
  const priorityKeys = new Set(priorityCourses.map((course) => course.key));
  return [...priorityCourses, ...fallbackCourses.filter((course) => !priorityKeys.has(course.key))];
}

export function persistLocalCourseDraft(course: CourseEntry): void {
  browserStorage.upsertLocalCourseDraft(course);
}

export function exportLocalCourseDraftToJson(course: CourseEntry): string {
  const envelope: LocalCourseDraftExportEnvelope = {
    kind: "lycium.localCourseDraft",
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    course,
  };

  return `${JSON.stringify(envelope, null, 2)}\n`;
}

export function deletePersistedLocalCourseDraft(courseKey: string): void {
  browserStorage.removeLocalCourseDraft(courseKey);
}

export function getLocalDraftMetadata(course: CourseEntry | null | undefined): LocalCourseDraftMetadata | null {
  const raw = course ? metadataRecord(course).localDraft : null;

  if (!raw || typeof raw !== "object") {
    return null;
  }

  const record = raw as Partial<LocalCourseDraftMetadata>;
  if (record.isLocalDraft !== true || !record.createdAt || !record.updatedAt) {
    return null;
  }

  const parentCourseKey = typeof record.parentCourseKey === "string" ? record.parentCourseKey : undefined;
  const draftId = typeof record.draftId === "string"
    ? record.draftId
    : `${parentCourseKey ?? course?.key ?? "local-course"}-draft`;
  const origin =
    record.origin === "fork" || record.origin === "import" || record.origin === "local_edit"
      ? record.origin
      : parentCourseKey
        ? "fork"
        : "local_edit";

  return {
    isLocalDraft: true,
    schemaVersion: 1,
    draftId,
    origin,
    parentCourseKey,
    parentCourseTitle: typeof record.parentCourseTitle === "string" ? record.parentCourseTitle : undefined,
    forkedFromTitle: typeof record.forkedFromTitle === "string" ? record.forkedFromTitle : undefined,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    revision: typeof record.revision === "number" ? record.revision : 1,
  };
}

export function isLocalCourseDraft(course: CourseEntry): boolean {
  return Boolean(getLocalDraftMetadata(course));
}

export function createLocalCourseFork(course: CourseEntry): CourseEntry {
  const now = new Date().toISOString();
  const forkedFromTitle = baseForkTitle(course);
  const forkTitle = `Fork of ${forkedFromTitle}`;
  const forkData = JSON.parse(JSON.stringify(course.data)) as CourseEntry["data"];
  const parentDraft = getLocalDraftMetadata(course);
  const parentCourseKey = parentDraft?.parentCourseKey ?? course.key;
  const forkHistoryEntry: LyciumCourseEditHistoryEntry = {
    operationType: "fork_course",
    createdAt: now,
    validationState: "unchecked",
  };

  forkData.title = forkTitle;
  forkData.metadata = {
    ...(forkData.metadata ?? {}),
    editPolicy: {
      ...((forkData.metadata?.editPolicy as Record<string, unknown> | undefined) ?? {}),
      editable: true,
      ownerCanEdit: true,
      learnersCanFork: true,
    },
    localDraft: {
      isLocalDraft: true,
      schemaVersion: 1,
      draftId: `${parentCourseKey}-draft-${Date.now().toString(36)}`,
      origin: "fork",
      parentCourseKey,
      parentCourseTitle: parentDraft?.parentCourseTitle ?? forkedFromTitle,
      forkedFromTitle,
      createdAt: now,
      updatedAt: now,
      revision: 1,
    },
    editHistory: [
      ...readEditHistory(forkData.metadata),
      forkHistoryEntry,
    ],
  };

  return {
    ...course,
    key: `${parentCourseKey}-fork-${Date.now().toString(36)}`,
    title: forkTitle,
    source: "local",
    status: "draft",
    snapshotId: undefined,
    generation_trace: undefined,
    data: forkData,
  };
}

export function createManualCourseDraft(): CourseEntry {
  const now = new Date().toISOString();
  const stamp = Date.now().toString(36);
  const key = `manual-course-${stamp}`;
  const title = "Untitled course";
  const editHistoryEntry: LyciumCourseEditHistoryEntry = {
    operationType: "create_manual_course",
    createdAt: now,
    validationState: "unchecked",
  };

  return {
    key,
    title,
    source: "local",
    status: "draft",
    data: {
      title,
      shortDescription: "A blank local course draft.",
      orderMandatory: false,
      metadata: {
        pacingLabel: "Module",
        editPolicy: {
          editable: true,
          ownerCanEdit: true,
          learnersCanFork: true,
        },
        localDraft: {
          isLocalDraft: true,
          schemaVersion: 1,
          draftId: `${key}-draft`,
          origin: "local_edit",
          createdAt: now,
          updatedAt: now,
          revision: 1,
        },
        editHistory: [editHistoryEntry],
      },
      modules: [
        {
          id: `${key}-m01`,
          title: "Module 1",
          sections: [
            {
              id: `${key}-m01-s01`,
              title: "Section title",
              pageType: "learn",
              sectionType: "lesson",
              content: [],
            },
          ],
        },
      ],
    },
  };
}

export function importLocalCourseDraftFromJson(jsonText: string): CourseEntry {
  const parsed = JSON.parse(jsonText) as unknown;
  const candidate =
    parsed && typeof parsed === "object" && (parsed as Record<string, unknown>).kind === "lycium.localCourseDraft"
      ? (parsed as Partial<LocalCourseDraftExportEnvelope>).course
      : parsed;

  if (!isCourseEntryCandidate(candidate)) {
    throw new Error("Imported file is not a Lycium local draft.");
  }

  const now = new Date().toISOString();
  const stamp = Date.now().toString(36);
  const importedData = JSON.parse(JSON.stringify(candidate.data)) as CourseEntry["data"];
  const importedDraft = getLocalDraftMetadata(candidate);
  const importTitle = candidate.title;
  const importHistoryEntry: LyciumCourseEditHistoryEntry = {
    operationType: "import_local_draft",
    createdAt: now,
    validationState: "unchecked",
  };

  importedData.title = importTitle;
  importedData.metadata = {
    ...(importedData.metadata ?? {}),
    localDraft: {
      isLocalDraft: true,
      schemaVersion: 1,
      draftId: `${importedDraft?.draftId ?? candidate.key}-import-${stamp}`,
      origin: "import",
      parentCourseKey: importedDraft?.parentCourseKey,
      parentCourseTitle: importedDraft?.parentCourseTitle ?? importedDraft?.forkedFromTitle,
      forkedFromTitle: importedDraft?.forkedFromTitle,
      createdAt: now,
      updatedAt: now,
      revision: 1,
    },
    editHistory: [
      ...readEditHistory(importedData.metadata),
      importHistoryEntry,
    ],
  };

  return {
    ...candidate,
    key: `${candidate.key}-import-${stamp}`,
    title: importTitle,
    source: "local",
    status: "draft",
    snapshotId: undefined,
    generation_trace: undefined,
    qualityReport: undefined,
    data: importedData,
  };
}

export function markLocalDraftSaved(course: CourseEntry, data: CourseEntry["data"]): CourseEntry {
  const now = new Date().toISOString();
  const currentDraft = getLocalDraftMetadata(course);
  const parentCourseKey = currentDraft?.parentCourseKey ?? course.key;
  const parentCourseTitle = currentDraft?.parentCourseTitle ?? currentDraft?.forkedFromTitle ?? baseForkTitle(course);
  const localDraft: LocalCourseDraftMetadata = {
    isLocalDraft: true,
    schemaVersion: 1,
    draftId: currentDraft?.draftId ?? `${parentCourseKey}-draft-${Date.now().toString(36)}`,
    origin: currentDraft?.origin ?? (currentDraft?.parentCourseKey ? "fork" : "local_edit"),
    parentCourseKey,
    parentCourseTitle,
    forkedFromTitle: currentDraft?.forkedFromTitle ?? parentCourseTitle,
    createdAt: currentDraft?.createdAt ?? now,
    updatedAt: now,
    revision: (currentDraft?.revision ?? 0) + 1,
  };
  const saveHistoryEntry: LyciumCourseEditHistoryEntry = {
    operationType: "save_local_draft",
    createdAt: now,
    validationState: "unchecked",
  };

  return {
    ...course,
    title: data.title,
    data: {
      ...data,
      metadata: {
        ...(data.metadata ?? {}),
        localDraft,
        editHistory: [
          ...readEditHistory(data.metadata),
          saveHistoryEntry,
        ],
      },
    },
    source: "local",
    status: course.status === "published" ? "draft" : course.status,
  };
}

export function saveLocalCourseDraftConflictSafe(course: CourseEntry, data: CourseEntry["data"]): LocalCourseDraftSaveResult {
  const persistedCourse = readPersistedLocalCourseEntries().find((draftCourse) => draftCourse.key === course.key);
  const conflictReason = persistedCourse ? draftConflictReason(persistedCourse, course) : null;

  if (persistedCourse && conflictReason === "newer_revision" && !hasSameDraftContent(persistedCourse, data)) {
    const conflictCourse = createConflictDraft(course, data, persistedCourse, conflictReason);
    persistLocalCourseDraft(conflictCourse);
    return {
      course: conflictCourse,
      conflictDetected: true,
      persistedCourse,
      conflictReason,
    };
  }

  if (persistedCourse && conflictReason === "newer_revision") {
    return {
      course: persistedCourse,
      conflictDetected: false,
    };
  }

  const courseToSave =
    persistedCourse && conflictReason === "newer_timestamp"
      ? {
          ...course,
          data: {
            ...course.data,
            metadata: {
              ...(course.data.metadata ?? {}),
              localDraft: getLocalDraftMetadata(persistedCourse) ?? (course.data.metadata as Record<string, unknown> | undefined)?.localDraft,
            },
          },
        }
      : course;
  const savedCourse = markLocalDraftSaved(courseToSave, data);
  persistLocalCourseDraft(savedCourse);

  return {
    course: savedCourse,
    conflictDetected: false,
  };
}

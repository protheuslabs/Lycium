export type LyciumCourseSnapshotStatus = "draft" | "review" | "published" | "archived";

export type LyciumCourseEditPolicy = {
  editable?: boolean;
  ownerCanEdit?: boolean;
  maintainersCanEdit?: boolean;
  learnersCanFork?: boolean;
  contributorsCanSuggest?: boolean;
  lockedSections?: string[];
  lockedBlocks?: string[];
  publishGateRequired?: boolean;
};

export type LyciumCourseSnapshotLifecycle = {
  lineageId?: string;
  canonicalSlug?: string;
  snapshotId?: string;
  version?: number;
  status?: LyciumCourseSnapshotStatus;
  basedOnSnapshotId?: string;
  forkedFromLineageId?: string;
  parentSnapshotHash?: string;
  publishedAt?: string;
  archivedAt?: string;
};

export type LyciumCourseEditHistoryEntry = {
  id?: string;
  editorId?: string;
  operationType: string;
  targetElementId?: string;
  previousValueRef?: string;
  newValueRef?: string;
  createdAt?: string;
  validationState?: "unchecked" | "valid" | "invalid";
};


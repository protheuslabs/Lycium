import type {
  LyciumCourseBlock,
  LyciumCourseData,
  LyciumCourseEditHistoryEntry,
  LyciumCourseEditPolicy,
  LyciumCourseEntry,
  LyciumCourseSourceCoveragePolicy,
  LyciumCourseSourceGap,
  LyciumCourseSourceGapSuggestion,
  LyciumCourseModule,
  LyciumCourseSection,
  LyciumCourseSnapshotLifecycle,
  LyciumAgentKeyRecord,
  LyciumAgentModelRecord,
  LyciumAgentProviderRecord,
  LyciumBookmarkRecord,
  LyciumProgressRecord,
  LyciumSectionStatus,
  LyciumThemeMode,
} from "@lycium/contracts";

export type CourseBlock = LyciumCourseBlock;
export type CourseSection = LyciumCourseSection;
export type CourseModule = LyciumCourseModule;
export type CourseData = LyciumCourseData;
export type {
  LyciumCourseEditHistoryEntry,
  LyciumCourseEditPolicy,
  LyciumCourseSnapshotLifecycle,
  LyciumCourseSourceCoveragePolicy,
  LyciumCourseSourceGap,
  LyciumCourseSourceGapSuggestion,
};

export type CourseEntry = Omit<LyciumCourseEntry, "source"> & {
  source: "local" | "remote";
};

export type AgentModelRecord = LyciumAgentModelRecord;
export type AgentProviderRecord = LyciumAgentProviderRecord;
export type AgentKeyRecord = LyciumAgentKeyRecord;
export type ThemeMode = LyciumThemeMode;
export type CourseBookmarkRecord = LyciumBookmarkRecord;
export type SectionStatus = LyciumSectionStatus;
export type CourseProgressRecord = LyciumProgressRecord;

export type RouteInfo = {
  kind: "home" | "course" | "settings" | "program";
  courseSlug: string | null;
  unitSlug: string | null;
  catalogView?: "programs" | "courses" | null;
  programSlug?: string | null;
  clusterSlug?: string | null;
};

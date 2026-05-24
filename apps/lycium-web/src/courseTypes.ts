import type {
  LyciumCourseBlock,
  LyciumCourseData,
  LyciumCourseEntry,
  LyciumCourseModule,
  LyciumCourseSection,
} from "@lycium/contracts";

export type CourseBlock = LyciumCourseBlock;
export type CourseSection = LyciumCourseSection;
export type CourseModule = LyciumCourseModule;
export type CourseData = LyciumCourseData;

export type CourseEntry = Omit<LyciumCourseEntry, "source"> & {
  source: "local" | "remote";
};

export type AgentModelRecord = {
  id: string;
  label?: string | null;
};

export type AgentProviderRecord = {
  id: string;
  label: string;
  default_model?: string | null;
  model_fetch_supported?: boolean;
  generation_adapter?: string;
};

export type AgentKeyRecord = {
  id: string;
  provider_id: string;
  provider_label: string;
  key_preview: string;
  model?: string | null;
  models?: AgentModelRecord[];
  models_fetched_at?: string | null;
  is_active: boolean;
};

export type ThemeMode = "light" | "auto" | "dark";

export type CourseBookmarkRecord = {
  course_key?: string;
  course_title?: string | null;
  section_id?: string | null;
  section_title?: string | null;
  path?: string | null;
};

export type SectionStatus = "completed" | "locked" | "seen" | "timed";

export type CourseProgressRecord = {
  completedSectionIds: string[];
  sectionStatuses: Record<string, SectionStatus>;
};

export type RouteInfo = {
  kind: "home" | "course" | "settings";
  courseSlug: string | null;
  unitSlug: string | null;
};

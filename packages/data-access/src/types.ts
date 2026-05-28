import type {
  LyciumAgentProviderRecord,
  LyciumBookmarkRecord,
  LyciumCourseData,
  LyciumCourseEntry,
  LyciumCourseFeedbackPayload,
  LyciumCourseFeedbackRecord,
  LyciumCourseHealthRecord,
  LyciumCourseGenerationExperiment,
  LyciumCourseGenerationJob,
  LyciumCourseGenerationRequest,
  LyciumCourseQualityReport,
  LyciumGeneratedCourseRecord,
  LyciumLocalSettings,
  LyciumProgressRecord,
  LyciumQuizProgressRecord,
  LyciumThemeMode,
} from "@lycium/contracts";

export const DEFAULT_LYCIUM_API_BASE = "http://127.0.0.1:8000";

export type LyciumRuntimeMode = "local" | "cloud" | "static" | "infring";

export type CourseCardRecord = {
  key: string;
  title: string;
  shortDescription?: string;
  category?: string;
  tags?: string[];
  source: LyciumRuntimeMode;
  course?: LyciumCourseEntry;
};

export type CourseRepository = {
  listCourses(): Promise<CourseCardRecord[]>;
  getCourse(courseKeyOrSlug: string): Promise<LyciumCourseEntry | null>;
  getCourseSnapshot(courseKeyOrSlug: string): Promise<LyciumCourseData | null>;
};

export type ProgressRepository = {
  getProgress(courseKey: string): Promise<LyciumProgressRecord | null>;
  saveProgress(courseKey: string, progress: LyciumProgressRecord): Promise<void>;
};

export type GenerationRepository = {
  createCourseGenerationJob(request: LyciumCourseGenerationRequest): Promise<LyciumGeneratedCourseRecord>;
  getCourseQualityReport(courseId: string | number): Promise<LyciumCourseQualityReport>;
  publishCourse(courseId: string | number): Promise<LyciumGeneratedCourseRecord>;
};

export type LyciumRepositorySet = {
  mode: LyciumRuntimeMode;
  courses: CourseRepository;
  progress: ProgressRepository;
  generation?: GenerationRepository;
};

export type LyciumRuntimeConfig = {
  mode: LyciumRuntimeMode;
  apiBaseUrl: string;
  catalogUrl?: string;
  courseBaseUrl?: string;
  headers?: HeadersInit | (() => HeadersInit);
};

export type LyciumRuntimeConfigInput = {
  mode?: string | null;
  apiBaseUrl?: string | null;
  catalogUrl?: string | null;
  courseBaseUrl?: string | null;
  headers?: HeadersInit | (() => HeadersInit);
};

export type JsonCourseCatalogItem = {
  key: string;
  title: string;
  shortDescription?: string;
  category?: string;
  tags?: string[];
  courseUrl?: string;
  course?: LyciumCourseData;
};

export type JsonCourseCatalog = {
  courses: JsonCourseCatalogItem[];
};

export type JsonCourseRepositoryOptions = {
  catalogUrl: string;
  courseBaseUrl?: string;
  mode?: LyciumRuntimeMode;
};

export type HttpRepositoryOptions = {
  baseUrl: string;
  mode: Exclude<LyciumRuntimeMode, "static">;
  catalogPath?: string;
  coursePath?: (courseKeyOrSlug: string) => string;
  progressPath?: (courseKey: string) => string;
  generationPath?: string;
  headers?: HeadersInit | (() => HeadersInit);
};

export type LocalCompletionMirrorPayload = {
  course_key: string;
  course_title?: string | null;
  section_id?: string | null;
  completed_section_ids: string[];
  section_statuses: Record<string, string>;
};

export type SnapshotProgressPayload = {
  learner_id: number;
  section_id: string;
  completion_state: string;
  mastery_score?: number;
  event_type?: string;
  event_payload?: Record<string, unknown>;
};

export type CreateLearnerPayload = {
  name: string;
  goal: string;
  level: string;
  preferences?: Record<string, unknown>;
};

export type LyciumLearnerRecord = {
  id: string | number;
  [key: string]: unknown;
};

export type LocalSettingsPayload = {
  provider_id: string;
  agent_api_key: string;
};

export type LocalActiveKeyPayload = {
  key_id: string;
};

export type LocalKeyModelPayload = {
  key_id: string;
  model: string;
};

export type LocalVerifyKeyPayload = {
  key_id: string;
};

export type LyciumLocalApi = {
  listRemoteCourses(limit?: number, status?: string): Promise<LyciumGeneratedCourseRecord[]>;
  generateCourse(request: LyciumCourseGenerationRequest): Promise<LyciumGeneratedCourseRecord>;
  experimentCourseGeneration(request: LyciumCourseGenerationRequest): Promise<LyciumCourseGenerationExperiment>;
  experimentStagedCourseGeneration(request: LyciumCourseGenerationRequest): Promise<LyciumCourseGenerationExperiment>;
  createCourseGenerationJob(request: LyciumCourseGenerationRequest): Promise<LyciumCourseGenerationJob>;
  getCourseGenerationJob(jobId: string | number): Promise<LyciumCourseGenerationJob>;
  resumeCourseGenerationJob(jobId: string | number): Promise<LyciumCourseGenerationJob>;
  getCourseQualityReport(courseId: string | number): Promise<LyciumCourseQualityReport>;
  publishCourse(courseId: string | number): Promise<LyciumGeneratedCourseRecord>;
  createLearner(payload: CreateLearnerPayload): Promise<LyciumLearnerRecord>;
  mirrorCompletion(payload: LocalCompletionMirrorPayload): Promise<void>;
  loadCompletion(courseKey: string): Promise<unknown>;
  saveBookmark(bookmark: LyciumBookmarkRecord): Promise<void>;
  loadBookmark(courseKey: string): Promise<LyciumBookmarkRecord | null>;
  saveCourseFeedback(payload: LyciumCourseFeedbackPayload): Promise<LyciumCourseFeedbackRecord>;
  loadCourseFeedback(courseKey: string): Promise<LyciumCourseFeedbackRecord | null>;
  loadCourseHealth(courseKey: string): Promise<LyciumCourseHealthRecord | null>;
  saveSnapshotProgress(snapshotId: number, payload: SnapshotProgressPayload): Promise<void>;
  loadAgentProviders(): Promise<LyciumAgentProviderRecord[]>;
  loadSettings(): Promise<LyciumLocalSettings>;
  saveSettings(payload: LocalSettingsPayload): Promise<LyciumLocalSettings>;
  activateAgentKey(payload: LocalActiveKeyPayload): Promise<LyciumLocalSettings>;
  updateAgentKeyModel(payload: LocalKeyModelPayload): Promise<LyciumLocalSettings>;
  verifyAgentKey(payload: LocalVerifyKeyPayload): Promise<LyciumLocalSettings>;
};

export type {
  LyciumAgentProviderRecord,
  LyciumBookmarkRecord,
  LyciumCourseData,
  LyciumCourseEntry,
  LyciumCourseFeedbackPayload,
  LyciumCourseFeedbackRecord,
  LyciumCourseHealthRecord,
  LyciumCourseGenerationExperiment,
  LyciumCourseGenerationJob,
  LyciumCourseGenerationRequest,
  LyciumCourseQualityReport,
  LyciumGeneratedCourseRecord,
  LyciumLocalSettings,
  LyciumProgressRecord,
  LyciumQuizProgressRecord,
  LyciumThemeMode,
};

import type {
  LyciumAgentProviderRecord,
  LyciumBookmarkRecord,
  LyciumCourseData,
  LyciumCourseEntry,
  LyciumCourseGenerationRequest,
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
};

export type LyciumRepositorySet = {
  mode: LyciumRuntimeMode;
  courses: CourseRepository;
  progress: ProgressRepository;
  generation?: GenerationRepository;
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

export type LyciumLocalApi = {
  listRemoteCourses(limit?: number): Promise<LyciumGeneratedCourseRecord[]>;
  generateCourse(request: LyciumCourseGenerationRequest): Promise<LyciumGeneratedCourseRecord>;
  createLearner(payload: CreateLearnerPayload): Promise<LyciumLearnerRecord>;
  mirrorCompletion(payload: LocalCompletionMirrorPayload): Promise<void>;
  loadCompletion(courseKey: string): Promise<unknown>;
  saveBookmark(bookmark: LyciumBookmarkRecord): Promise<void>;
  loadBookmark(courseKey: string): Promise<LyciumBookmarkRecord | null>;
  saveSnapshotProgress(snapshotId: number, payload: SnapshotProgressPayload): Promise<void>;
  loadAgentProviders(): Promise<LyciumAgentProviderRecord[]>;
  loadSettings(): Promise<LyciumLocalSettings>;
  saveSettings(payload: LocalSettingsPayload): Promise<LyciumLocalSettings>;
  activateAgentKey(payload: LocalActiveKeyPayload): Promise<LyciumLocalSettings>;
  updateAgentKeyModel(payload: LocalKeyModelPayload): Promise<LyciumLocalSettings>;
};

function normalizeApiBase(apiBase?: string): string {
  return (apiBase || DEFAULT_LYCIUM_API_BASE).replace(/\/+$/, "");
}

async function readJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(errorBody?.detail ?? fallbackMessage);
  }

  return response.json() as Promise<T>;
}

export function createLyciumLocalApi(apiBase?: string): LyciumLocalApi {
  const base = normalizeApiBase(apiBase);

  return {
    async listRemoteCourses(limit = 25) {
      const response = await fetch(`${base}/v1/courses?limit=${encodeURIComponent(String(limit))}`);
      return readJsonResponse<LyciumGeneratedCourseRecord[]>(response, "Failed to fetch courses");
    },

    async generateCourse(request) {
      const response = await fetch(`${base}/v1/agent/courses/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      return readJsonResponse<LyciumGeneratedCourseRecord>(response, "Generation failed");
    },

    async createLearner(payload) {
      const response = await fetch(`${base}/v1/learners`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return readJsonResponse<LyciumLearnerRecord>(response, "Failed to create learner");
    },

    async mirrorCompletion(payload) {
      const response = await fetch(`${base}/v1/local/completion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error("Failed to mirror local completion");
      }
    },

    async loadCompletion(courseKey) {
      const response = await fetch(`${base}/v1/local/completion/${encodeURIComponent(courseKey)}`);
      return readJsonResponse<unknown>(response, "Local completion unavailable");
    },

    async saveBookmark(bookmark) {
      const response = await fetch(`${base}/v1/local/bookmarks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookmark),
      });
      if (!response.ok) {
        throw new Error("Failed to save course bookmark");
      }
    },

    async loadBookmark(courseKey) {
      const response = await fetch(`${base}/v1/local/bookmarks/${encodeURIComponent(courseKey)}`);
      return readJsonResponse<LyciumBookmarkRecord | null>(response, "Local bookmark unavailable");
    },

    async saveSnapshotProgress(snapshotId, payload) {
      const response = await fetch(`${base}/v1/courses/${snapshotId}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error("Failed to post progress");
      }
    },

    async loadAgentProviders() {
      const response = await fetch(`${base}/v1/local/ai/providers`);
      return readJsonResponse<LyciumAgentProviderRecord[]>(response, "AI providers unavailable");
    },

    async loadSettings() {
      const response = await fetch(`${base}/v1/local/settings`);
      return readJsonResponse<LyciumLocalSettings>(response, "Settings unavailable");
    },

    async saveSettings(payload) {
      const response = await fetch(`${base}/v1/local/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return readJsonResponse<LyciumLocalSettings>(response, "Settings save failed");
    },

    async activateAgentKey(payload) {
      const response = await fetch(`${base}/v1/local/settings/active-key`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return readJsonResponse<LyciumLocalSettings>(response, "Active key update failed");
    },

    async updateAgentKeyModel(payload) {
      const response = await fetch(`${base}/v1/local/settings/key-model`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return readJsonResponse<LyciumLocalSettings>(response, "Model update failed");
    },
  };
}

function getLocalStorage(): Storage | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

function readJson<T>(key: string): T | null {
  const storage = getLocalStorage();
  if (!storage) {
    return null;
  }

  try {
    const value = storage.getItem(key);
    return value ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  const storage = getLocalStorage();
  if (!storage) {
    return;
  }

  storage.setItem(key, JSON.stringify(value));
}

export function getCourseProgressStorageKey(courseKey: string): string {
  return `lycium-progress-${courseKey}`;
}

export function getCourseBookmarkStorageKey(courseKey: string): string {
  return `lycium-bookmark-${courseKey}`;
}

export function getQuizProgressStorageKey(quizKey: string): string {
  return `lycium-quiz-progress-${quizKey || "quiz"}`;
}

export function getQuizMarkerStorageKey(quizKey: string): string {
  return `lycium-quiz-marker-${quizKey || "quiz"}`;
}

export function createBrowserStorageRepository() {
  return {
    readProgress(courseKey: string): LyciumProgressRecord | null {
      return readJson<LyciumProgressRecord>(getCourseProgressStorageKey(courseKey));
    },

    writeProgress(courseKey: string, progress: LyciumProgressRecord): void {
      writeJson(getCourseProgressStorageKey(courseKey), progress);
    },

    readBookmark(courseKey: string): LyciumBookmarkRecord | null {
      return readJson<LyciumBookmarkRecord>(getCourseBookmarkStorageKey(courseKey));
    },

    writeBookmark(courseKey: string, bookmark: LyciumBookmarkRecord): void {
      writeJson(getCourseBookmarkStorageKey(courseKey), bookmark);
    },

    readLearnerId(): number | null {
      const storage = getLocalStorage();
      const value = storage?.getItem("lycium-learner-id");
      return value ? Number(value) : null;
    },

    writeLearnerId(learnerId: string | number): void {
      const storage = getLocalStorage();
      storage?.setItem("lycium-learner-id", String(learnerId));
    },

    readThemeMode(): LyciumThemeMode | null {
      const value = getLocalStorage()?.getItem("lycium-theme-mode");
      return value === "light" || value === "dark" || value === "auto" ? value : null;
    },

    writeThemeMode(mode: LyciumThemeMode): void {
      getLocalStorage()?.setItem("lycium-theme-mode", mode);
    },

    readQuizProgress(quizKey: string): LyciumQuizProgressRecord | null {
      return readJson<LyciumQuizProgressRecord>(getQuizProgressStorageKey(quizKey));
    },

    writeQuizProgress(quizKey: string, progress: LyciumQuizProgressRecord): void {
      writeJson(getQuizProgressStorageKey(quizKey), progress);
    },

    readQuizMarkers(quizKey: string): boolean[] | null {
      return readJson<boolean[]>(getQuizMarkerStorageKey(quizKey));
    },

    writeQuizMarkers(quizKey: string, markers: boolean[]): void {
      writeJson(getQuizMarkerStorageKey(quizKey), markers);
    },

    removeQuizMarkers(quizKey: string): void {
      getLocalStorage()?.removeItem(getQuizMarkerStorageKey(quizKey));
    },
  };
}

export function createStaticCourseRepository(courses: LyciumCourseEntry[]): CourseRepository {
  return {
    async listCourses() {
      return courses.map((course) => ({
        key: course.key,
        title: course.title,
        shortDescription: course.data.shortDescription,
        category: course.data.category,
        tags: course.data.tags,
        source: "static",
        course,
      }));
    },
    async getCourse(courseKeyOrSlug: string) {
      return courses.find((course) => course.key === courseKeyOrSlug || course.title === courseKeyOrSlug) ?? null;
    },
    async getCourseSnapshot(courseKeyOrSlug: string) {
      return (await this.getCourse(courseKeyOrSlug))?.data ?? null;
    },
  };
}

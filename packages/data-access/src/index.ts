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

function normalizeRuntimeMode(mode: string | null | undefined): LyciumRuntimeMode {
  return mode === "cloud" || mode === "static" || mode === "infring" || mode === "local" ? mode : "local";
}

export function resolveLyciumRuntimeConfig(input: LyciumRuntimeConfigInput = {}): LyciumRuntimeConfig {
  return {
    mode: normalizeRuntimeMode(input.mode),
    apiBaseUrl: normalizeApiBase(input.apiBaseUrl ?? undefined),
    catalogUrl: input.catalogUrl || undefined,
    courseBaseUrl: input.courseBaseUrl || undefined,
    headers: input.headers,
  };
}

function joinUrl(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const normalizedPath = path.replace(/^\/+/, "");
  return `${normalizedBase}/${normalizedPath}`;
}

function resolveHeaders(headers?: HeadersInit | (() => HeadersInit)): HeadersInit {
  return typeof headers === "function" ? headers() : headers ?? {};
}

async function readJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(errorBody?.detail ?? fallbackMessage);
  }

  return response.json() as Promise<T>;
}

function courseEntryFromSnapshot(
  key: string,
  course: LyciumCourseData,
  source: string,
  snapshotId?: number,
): LyciumCourseEntry {
  return {
    key,
    title: course.title,
    data: course,
    source,
    snapshotId,
  };
}

function courseEntryFromGeneratedRecord(record: LyciumGeneratedCourseRecord, source: string): LyciumCourseEntry {
  const snapshotId = Number(record.id);
  return {
    key: `remote-${record.id}`,
    title: record.title,
    data: record.structure,
    source,
    snapshotId: Number.isFinite(snapshotId) ? snapshotId : undefined,
  };
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

export function createJsonCourseRepository({
  catalogUrl,
  courseBaseUrl,
  mode = "static",
}: JsonCourseRepositoryOptions): CourseRepository {
  let catalogCache: JsonCourseCatalog | null = null;
  const loadCatalog = async () => {
    if (catalogCache) {
      return catalogCache;
    }

    const response = await fetch(catalogUrl);
    catalogCache = await readJsonResponse<JsonCourseCatalog>(response, "Course catalog unavailable");
    return catalogCache;
  };

  const resolveCourseUrl = (item: JsonCourseCatalogItem) => {
    if (item.courseUrl) {
      return item.courseUrl;
    }
    if (!courseBaseUrl) {
      return null;
    }
    return joinUrl(courseBaseUrl, `${encodeURIComponent(item.key)}/course.json`);
  };

  return {
    async listCourses() {
      const catalog = await loadCatalog();
      return catalog.courses.map((item) => ({
        key: item.key,
        title: item.title,
        shortDescription: item.shortDescription ?? item.course?.shortDescription,
        category: item.category ?? item.course?.category,
        tags: item.tags ?? item.course?.tags,
        source: mode,
        course: item.course ? courseEntryFromSnapshot(item.key, item.course, mode) : undefined,
      }));
    },

    async getCourse(courseKeyOrSlug: string) {
      const catalog = await loadCatalog();
      const item = catalog.courses.find((candidate) => candidate.key === courseKeyOrSlug || candidate.title === courseKeyOrSlug);
      if (!item) {
        return null;
      }
      if (item.course) {
        return courseEntryFromSnapshot(item.key, item.course, mode);
      }

      const courseUrl = resolveCourseUrl(item);
      if (!courseUrl) {
        return null;
      }

      const response = await fetch(courseUrl);
      const course = await readJsonResponse<LyciumCourseData>(response, "Course snapshot unavailable");
      return courseEntryFromSnapshot(item.key, course, mode);
    },

    async getCourseSnapshot(courseKeyOrSlug: string) {
      return (await this.getCourse(courseKeyOrSlug))?.data ?? null;
    },
  };
}

export function createHttpCourseRepository(options: HttpRepositoryOptions): CourseRepository {
  const base = normalizeApiBase(options.baseUrl);
  const catalogPath = options.catalogPath ?? "/v1/courses?limit=100";
  const coursePath = options.coursePath ?? ((courseKeyOrSlug) => `/v1/courses/${encodeURIComponent(courseKeyOrSlug)}`);

  return {
    async listCourses() {
      const response = await fetch(joinUrl(base, catalogPath), {
        headers: resolveHeaders(options.headers),
      });
      const records = await readJsonResponse<LyciumGeneratedCourseRecord[]>(response, "Course catalog unavailable");
      return records.map((record) => {
        const course = courseEntryFromGeneratedRecord(record, options.mode);
        return {
          key: course.key,
          title: course.title,
          shortDescription: course.data.shortDescription,
          category: course.data.category,
          tags: course.data.tags,
          source: options.mode,
          course,
        };
      });
    },

    async getCourse(courseKeyOrSlug: string) {
      const response = await fetch(joinUrl(base, coursePath(courseKeyOrSlug)), {
        headers: resolveHeaders(options.headers),
      });
      if (response.status === 404) {
        return null;
      }
      const record = await readJsonResponse<LyciumGeneratedCourseRecord>(response, "Course snapshot unavailable");
      return courseEntryFromGeneratedRecord(record, options.mode);
    },

    async getCourseSnapshot(courseKeyOrSlug: string) {
      return (await this.getCourse(courseKeyOrSlug))?.data ?? null;
    },
  };
}

export function createHttpProgressRepository(options: HttpRepositoryOptions): ProgressRepository {
  const base = normalizeApiBase(options.baseUrl);
  const progressPath = options.progressPath ?? ((courseKey) => `/v1/local/completion/${encodeURIComponent(courseKey)}`);

  return {
    async getProgress(courseKey) {
      const response = await fetch(joinUrl(base, progressPath(courseKey)), {
        headers: resolveHeaders(options.headers),
      });
      if (response.status === 404) {
        return null;
      }
      return readJsonResponse<LyciumProgressRecord>(response, "Progress unavailable");
    },

    async saveProgress(courseKey, progress) {
      const response = await fetch(joinUrl(base, progressPath(courseKey)), {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...resolveHeaders(options.headers) },
        body: JSON.stringify(progress),
      });
      if (!response.ok) {
        throw new Error("Progress save failed");
      }
    },
  };
}

export function createHttpGenerationRepository(options: HttpRepositoryOptions): GenerationRepository {
  const base = normalizeApiBase(options.baseUrl);
  const generationPath = options.generationPath ?? "/v1/agent/courses/generate";

  return {
    async createCourseGenerationJob(request) {
      const response = await fetch(joinUrl(base, generationPath), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...resolveHeaders(options.headers) },
        body: JSON.stringify(request),
      });
      return readJsonResponse<LyciumGeneratedCourseRecord>(response, "Course generation failed");
    },
  };
}

export function createCloudRepositorySet(options: Omit<HttpRepositoryOptions, "mode">): LyciumRepositorySet {
  const httpOptions = { ...options, mode: "cloud" as const };
  return {
    mode: "cloud",
    courses: createHttpCourseRepository(httpOptions),
    progress: createHttpProgressRepository(httpOptions),
    generation: createHttpGenerationRepository(httpOptions),
  };
}

export function createInfringRepositorySet(options: Omit<HttpRepositoryOptions, "mode">): LyciumRepositorySet {
  const httpOptions = { ...options, mode: "infring" as const };
  return {
    mode: "infring",
    courses: createHttpCourseRepository(httpOptions),
    progress: createHttpProgressRepository(httpOptions),
    generation: createHttpGenerationRepository(httpOptions),
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

export function createBrowserProgressRepository(): ProgressRepository {
  const storage = createBrowserStorageRepository();

  return {
    async getProgress(courseKey) {
      return storage.readProgress(courseKey);
    },

    async saveProgress(courseKey, progress) {
      storage.writeProgress(courseKey, progress);
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

export function createConfiguredRepositorySet(
  configInput: LyciumRuntimeConfigInput,
  localCourses: LyciumCourseEntry[] = [],
): LyciumRepositorySet {
  const config = resolveLyciumRuntimeConfig(configInput);

  if (config.mode === "cloud") {
    return createCloudRepositorySet({
      baseUrl: config.apiBaseUrl,
      headers: config.headers,
    });
  }

  if (config.mode === "infring") {
    return createInfringRepositorySet({
      baseUrl: config.apiBaseUrl,
      headers: config.headers,
    });
  }

  if (config.mode === "static" && config.catalogUrl) {
    return {
      mode: "static",
      courses: createJsonCourseRepository({
        catalogUrl: config.catalogUrl,
        courseBaseUrl: config.courseBaseUrl,
        mode: "static",
      }),
      progress: createBrowserProgressRepository(),
    };
  }

  return {
    mode: "local",
    courses: createStaticCourseRepository(localCourses),
    progress: createBrowserProgressRepository(),
    generation: createHttpGenerationRepository({
      baseUrl: config.apiBaseUrl,
      mode: "local",
    }),
  };
}

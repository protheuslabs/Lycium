import type { LyciumCourseData, LyciumCourseEntry } from "@lycium/contracts";
import type {
  CourseRepository,
  GenerationRepository,
  HttpRepositoryOptions,
  JsonCourseCatalog,
  JsonCourseCatalogItem,
  JsonCourseRepositoryOptions,
  LyciumLocalApi,
  LyciumGeneratedCourseRecord,
  LyciumRepositorySet,
  ProgressRepository,
} from "./types";
import { DEFAULT_LYCIUM_API_BASE } from "./types";

export function normalizeApiBase(apiBase?: string): string {
  return (apiBase || DEFAULT_LYCIUM_API_BASE).replace(/\/+$/, "");
}

export function joinUrl(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const normalizedPath = path.replace(/^\/+/, "");
  return `${normalizedBase}/${normalizedPath}`;
}

export function resolveHeaders(headers?: HeadersInit | (() => HeadersInit)): HeadersInit {
  return typeof headers === "function" ? headers() : headers ?? {};
}

export async function readJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
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
  return { key, title: course.title, data: course, source, snapshotId };
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
    async listRemoteCourses(limit = 25, status = "published") {
      const params = new URLSearchParams({ limit: String(limit), status });
      const response = await fetch(`${base}/v1/courses?${params.toString()}`);
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

    async experimentCourseGeneration(request) {
      const response = await fetch(`${base}/v1/agent/courses/experiment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      return readJsonResponse(response, "Course generation experiment failed");
    },

    async experimentStagedCourseGeneration(request) {
      const response = await fetch(`${base}/v1/agent/courses/experiment/staged`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      return readJsonResponse(response, "Staged course generation experiment failed");
    },

    async createCourseGenerationJob(request) {
      const response = await fetch(`${base}/v1/agent/courses/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      return readJsonResponse(response, "Failed to start course generation job");
    },

    async getCourseGenerationJob(jobId) {
      const response = await fetch(`${base}/v1/agent/courses/jobs/${encodeURIComponent(String(jobId))}`);
      return readJsonResponse(response, "Failed to fetch course generation job");
    },

    async resumeCourseGenerationJob(jobId) {
      const response = await fetch(`${base}/v1/agent/courses/jobs/${encodeURIComponent(String(jobId))}/resume`, {
        method: "POST",
      });
      return readJsonResponse(response, "Failed to resume course generation job");
    },

    async getCourseQualityReport(courseId) {
      const response = await fetch(`${base}/v1/courses/${encodeURIComponent(String(courseId))}/quality-report`);
      return readJsonResponse(response, "Course quality report unavailable");
    },

    async publishCourse(courseId) {
      const response = await fetch(`${base}/v1/courses/${encodeURIComponent(String(courseId))}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewer_id: "lycium-local-web", notes: "Published after local validation." }),
      });
      return readJsonResponse<LyciumGeneratedCourseRecord>(response, "Course publish failed");
    },

    async createLearner(payload) {
      const response = await fetch(`${base}/v1/learners`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return readJsonResponse(response, "Failed to create learner");
    },

    async mirrorCompletion(payload) {
      const response = await fetch(`${base}/v1/local/completion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Failed to mirror local completion");
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
      if (!response.ok) throw new Error("Failed to save course bookmark");
    },

    async loadBookmark(courseKey) {
      const response = await fetch(`${base}/v1/local/bookmarks/${encodeURIComponent(courseKey)}`);
      return readJsonResponse(response, "Local bookmark unavailable");
    },

    async saveCourseFeedback(payload) {
      const response = await fetch(`${base}/v1/local/course-feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return readJsonResponse(response, "Failed to save course feedback");
    },

    async loadCourseFeedback(courseKey) {
      const response = await fetch(`${base}/v1/local/course-feedback/${encodeURIComponent(courseKey)}`);
      if (response.status === 404) return null;
      return readJsonResponse(response, "Course feedback unavailable");
    },

    async saveSnapshotProgress(snapshotId, payload) {
      const response = await fetch(`${base}/v1/courses/${snapshotId}/progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Failed to post progress");
    },

    async loadAgentProviders() {
      const response = await fetch(`${base}/v1/local/ai/providers`);
      return readJsonResponse(response, "AI providers unavailable");
    },

    async loadSettings() {
      const response = await fetch(`${base}/v1/local/settings`);
      return readJsonResponse(response, "Settings unavailable");
    },

    async saveSettings(payload) {
      const response = await fetch(`${base}/v1/local/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return readJsonResponse(response, "Settings save failed");
    },

    async activateAgentKey(payload) {
      const response = await fetch(`${base}/v1/local/settings/active-key`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return readJsonResponse(response, "Active key update failed");
    },

    async updateAgentKeyModel(payload) {
      const response = await fetch(`${base}/v1/local/settings/key-model`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return readJsonResponse(response, "Model update failed");
    },
  };
}

export function createJsonCourseRepository({ catalogUrl, courseBaseUrl, mode = "static" }: JsonCourseRepositoryOptions): CourseRepository {
  let catalogCache: JsonCourseCatalog | null = null;
  const loadCatalog = async () => {
    if (catalogCache) return catalogCache;
    const response = await fetch(catalogUrl);
    catalogCache = await readJsonResponse<JsonCourseCatalog>(response, "Course catalog unavailable");
    return catalogCache;
  };

  const resolveCourseUrl = (item: JsonCourseCatalogItem) => item.courseUrl ?? (courseBaseUrl ? joinUrl(courseBaseUrl, `${encodeURIComponent(item.key)}/course.json`) : null);

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
      if (!item) return null;
      if (item.course) return courseEntryFromSnapshot(item.key, item.course, mode);
      const courseUrl = resolveCourseUrl(item);
      if (!courseUrl) return null;
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
      const response = await fetch(joinUrl(base, catalogPath), { headers: resolveHeaders(options.headers) });
      const records = await readJsonResponse<LyciumGeneratedCourseRecord[]>(response, "Course catalog unavailable");
      return records.map((record) => {
        const course = courseEntryFromGeneratedRecord(record, options.mode);
        return { key: course.key, title: course.title, shortDescription: course.data.shortDescription, category: course.data.category, tags: course.data.tags, source: options.mode, course };
      });
    },

    async getCourse(courseKeyOrSlug: string) {
      const response = await fetch(joinUrl(base, coursePath(courseKeyOrSlug)), { headers: resolveHeaders(options.headers) });
      if (response.status === 404) return null;
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
      const response = await fetch(joinUrl(base, progressPath(courseKey)), { headers: resolveHeaders(options.headers) });
      if (response.status === 404) return null;
      return readJsonResponse(response, "Progress unavailable");
    },

    async saveProgress(courseKey, progress) {
      const response = await fetch(joinUrl(base, progressPath(courseKey)), {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...resolveHeaders(options.headers) },
        body: JSON.stringify(progress),
      });
      if (!response.ok) throw new Error("Progress save failed");
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

    async getCourseQualityReport(courseId) {
      const response = await fetch(joinUrl(base, `/v1/courses/${encodeURIComponent(String(courseId))}/quality-report`), { headers: resolveHeaders(options.headers) });
      return readJsonResponse(response, "Course quality report unavailable");
    },

    async publishCourse(courseId) {
      const response = await fetch(joinUrl(base, `/v1/courses/${encodeURIComponent(String(courseId))}/publish`), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...resolveHeaders(options.headers) },
        body: JSON.stringify({ reviewer_id: "lycium-adapter", notes: "Published through repository adapter." }),
      });
      return readJsonResponse<LyciumGeneratedCourseRecord>(response, "Course publish failed");
    },
  };
}

export function createCloudRepositorySet(options: Omit<HttpRepositoryOptions, "mode">): LyciumRepositorySet {
  const httpOptions = { ...options, mode: "cloud" as const };
  return { mode: "cloud", courses: createHttpCourseRepository(httpOptions), progress: createHttpProgressRepository(httpOptions), generation: createHttpGenerationRepository(httpOptions) };
}

export function createInfringRepositorySet(options: Omit<HttpRepositoryOptions, "mode">): LyciumRepositorySet {
  const httpOptions = { ...options, mode: "infring" as const };
  return { mode: "infring", courses: createHttpCourseRepository(httpOptions), progress: createHttpProgressRepository(httpOptions), generation: createHttpGenerationRepository(httpOptions) };
}

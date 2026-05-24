import type { LyciumCourseData, LyciumCourseEntry } from "@lycium/contracts";

export type LyciumProgressRecord = {
  completedSectionIds: string[];
  sectionStatuses: Record<string, "completed" | "locked" | "seen" | "timed">;
};

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

export type GenerationRequest = {
  title?: string;
  description: string;
  difficulty?: "elementary" | "highschool" | "undergrad" | "postgrad";
  sourceUrls?: string[];
  sourceFileIds?: string[];
};

export type GenerationJobStatus = "queued" | "running" | "validating" | "ready" | "failed";

export type GenerationJob = {
  id: string;
  status: GenerationJobStatus;
  request: GenerationRequest;
  courseKey?: string;
  message?: string;
  createdAt: string;
  updatedAt: string;
};

export type GenerationRepository = {
  createCourseGenerationJob(request: GenerationRequest): Promise<GenerationJob>;
  getCourseGenerationJob(jobId: string): Promise<GenerationJob | null>;
};

export type LyciumRepositorySet = {
  mode: LyciumRuntimeMode;
  courses: CourseRepository;
  progress: ProgressRepository;
  generation?: GenerationRepository;
};

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

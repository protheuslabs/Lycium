import type { LyciumCourseEntry } from "@lycium/contracts";
import type { CourseRepository, LyciumRepositorySet, LyciumRuntimeConfigInput } from "./types";
import { createBrowserProgressRepository } from "./browserStorage";
import {
  createCloudRepositorySet,
  createHttpGenerationRepository,
  createInfringRepositorySet,
  createJsonCourseRepository,
} from "./http";
import { resolveLyciumRuntimeConfig } from "./runtime";

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
    return createCloudRepositorySet({ baseUrl: config.apiBaseUrl, headers: config.headers });
  }

  if (config.mode === "infring") {
    return createInfringRepositorySet({ baseUrl: config.apiBaseUrl, headers: config.headers });
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
    generation: createHttpGenerationRepository({ baseUrl: config.apiBaseUrl, mode: "local" }),
  };
}

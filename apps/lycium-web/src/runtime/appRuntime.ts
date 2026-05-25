import {
  createBrowserStorageRepository,
  createConfiguredRepositorySet,
  createLyciumLocalApi,
  resolveLyciumRuntimeConfig,
} from "@lycium/data-access";
import { localCourses } from "../courseData/localCourses";

export const API_BASE = process.env.NEXT_PUBLIC_LYCIUM_API_URL ?? "http://127.0.0.1:8000";

export const runtimeConfig = resolveLyciumRuntimeConfig({
  mode: process.env.NEXT_PUBLIC_LYCIUM_RUNTIME,
  apiBaseUrl: API_BASE,
  catalogUrl: process.env.NEXT_PUBLIC_LYCIUM_COURSE_CATALOG_URL,
  courseBaseUrl: process.env.NEXT_PUBLIC_LYCIUM_COURSE_BASE_URL,
});

export const repositorySet = createConfiguredRepositorySet(runtimeConfig, localCourses);
export const lyciumApi = createLyciumLocalApi(runtimeConfig.apiBaseUrl);
export const browserStorage = createBrowserStorageRepository();

export function scrollCoursePageToTop() {
  window.requestAnimationFrame(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  });
}

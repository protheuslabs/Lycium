import type { CourseBookmarkRecord, CourseEntry, CourseSection, RouteInfo } from "../courseTypes";
import type { LyciumProgram, LyciumRequirementGroup } from "@lycium/contracts";
import { createBrowserStorageRepository } from "@lycium/data-access";
import {
  DEFAULT_PROGRESS,
  normalizeProgressRecord,
  summarizeCourseProgress,
  type CourseProgressSummary,
} from "./courseProgress";

const browserStorage = createBrowserStorageRepository();

export const LYCIUM_SITE_ROOT = "https://protheuslabs.github.io/Lycium/";
export const LYCIUM_DEPLOY_BASE_PATH = "/Lycium";
export const LYCIUM_ROUTE_ROOT = "/";
export const COURSE_CATALOG_PATH = buildLyciumPath("catalog");
export const COURSE_CATALOG_PROGRAMS_PATH = buildLyciumPath("catalog", "programs");
export const COURSE_CATALOG_COURSES_PATH = buildLyciumPath("catalog", "courses");
export const SETTINGS_PATH = buildLyciumPath("settings");

function buildLyciumPath(...segments: string[]): string {
  const suffix = segments
    .map((segment) => segment.replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .join("/");

  return suffix ? `/${suffix}` : LYCIUM_ROUTE_ROOT;
}

function normalizeRoutePath(pathname: string): string {
  const rawPath = (() => {
    try {
      return new URL(pathname).pathname;
    } catch {
      return pathname;
    }
  })();
  let path = rawPath.split("?")[0].replace(/\/+$/, "") || "/";

  if (path === LYCIUM_ROUTE_ROOT || path === LYCIUM_DEPLOY_BASE_PATH) {
    return "/";
  }

  if (path.startsWith(`${LYCIUM_DEPLOY_BASE_PATH}/`)) {
    path = path.slice(LYCIUM_DEPLOY_BASE_PATH.length) || "/";
  }

  return path || "/";
}

export function slugifyCourseTitle(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getCoursePathSlug(course: CourseEntry): string {
  const base = slugifyCourseTitle(course.title || "course");
  return `${base}-${course.key}`;
}

export function getSectionPathSlug(section: CourseSection): string {
  const base = slugifyCourseTitle(section.title || "unit");
  const suffix = slugifyCourseTitle(section.id || "section");

  if (!base) {
    return suffix || "unit";
  }

  if (!suffix || base.endsWith(suffix)) {
    return base;
  }

  return `${base}-${suffix}`;
}

export function getCourseSectionPath(course: CourseEntry, section: CourseSection): string {
  return buildLyciumPath("courses", getCoursePathSlug(course), "units", getSectionPathSlug(section));
}

export function getCoursePath(course: CourseEntry): string {
  return buildLyciumPath("courses", getCoursePathSlug(course));
}

export function getProgramPathSlug(program: Pick<LyciumProgram, "id" | "title">): string {
  const base = slugifyCourseTitle(program.title || "program");
  return `${base}-${program.id}`;
}

export function getProgramClusterPathSlug(cluster: Pick<LyciumRequirementGroup, "id" | "displayName">): string {
  const base = slugifyCourseTitle(cluster.displayName || "cluster");
  return `${base}-${cluster.id}`;
}

export function getCatalogProgramPath(program: Pick<LyciumProgram, "id" | "title">): string {
  return buildLyciumPath("catalog", getProgramPathSlug(program));
}

export function getCatalogClusterPath(
  program: Pick<LyciumProgram, "id" | "title">,
  cluster: Pick<LyciumRequirementGroup, "id" | "displayName">,
): string {
  return buildLyciumPath("catalog", getProgramPathSlug(program), getProgramClusterPathSlug(cluster));
}

export function getProgramPath(program: Pick<LyciumProgram, "id" | "title">): string {
  return buildLyciumPath("programs", getProgramPathSlug(program));
}

export function getCourseSectionUrl(course: CourseEntry, section: CourseSection): string {
  const routePath = getCourseSectionPath(course, section).replace(/^\/+/, "");
  return new URL(routePath, LYCIUM_SITE_ROOT).toString();
}

export function getFirstCourseSection(course: CourseEntry): CourseSection | null {
  return course.data.modules[0]?.sections[0] ?? null;
}

export function getFlatCourseSections(course: CourseEntry): CourseSection[] {
  return course.data.modules.flatMap((module) => module.sections);
}

export function getCourseBookmarkStorageKey(course: CourseEntry): string {
  return `lycium-bookmark-${course.key}`;
}

export function readStoredCourseBookmark(course: CourseEntry): CourseBookmarkRecord | null {
  return browserStorage.readBookmark(course.key);
}

export function writeStoredCourseBookmark(course: CourseEntry, section: CourseSection, path: string): void {
  const bookmark: CourseBookmarkRecord = {
    course_key: course.key,
    course_title: course.title,
    section_id: section.id,
    section_title: section.title,
    path,
  };
  browserStorage.writeBookmark(course.key, bookmark);
}

export function findBookmarkedSection(course: CourseEntry, bookmark: CourseBookmarkRecord | null): CourseSection | null {
  if (!bookmark) {
    return null;
  }

  const courseSections = getFlatCourseSections(course);
  return (
    courseSections.find((section) => section.id === bookmark.section_id) ??
    courseSections.find((section) => normalizeRoutePath(bookmark.path ?? "") === normalizeRoutePath(getCourseSectionPath(course, section))) ??
    null
  );
}

export function getCourseSectionIndex(course: CourseEntry, section: CourseSection): number {
  return getFlatCourseSections(course).findIndex((candidate) => candidate.id === section.id);
}

export function getBookmarkedModuleSection(course: CourseEntry): { moduleTitle: string; sectionTitle: string } | null {
  const bookmark = readStoredCourseBookmark(course);
  if (!bookmark) {
    return null;
  }

  for (const module of course.data.modules) {
    for (const section of module.sections) {
      if (
        section.id === bookmark.section_id ||
        normalizeRoutePath(bookmark.path ?? "") === normalizeRoutePath(getCourseSectionPath(course, section))
      ) {
        return {
          moduleTitle: module.title,
          sectionTitle: section.title,
        };
      }
    }
  }

  return null;
}

export function getCourseSectionIds(course: CourseEntry): string[] {
  return getFlatCourseSections(course).map((section) => section.id);
}

export function getCourseProgress(course: CourseEntry): CourseProgressSummary {
  const sections = getCourseSectionIds(course);

  try {
    const progress = normalizeProgressRecord(browserStorage.readProgress(course.key));
    return summarizeCourseProgress(sections, progress);
  } catch {
    return summarizeCourseProgress(sections, DEFAULT_PROGRESS);
  }
}

export function parseCourseRoute(pathname: string): RouteInfo {
  const pathWithoutQuery = normalizeRoutePath(pathname);

  if (pathWithoutQuery === "/" || pathWithoutQuery === "/catalog" || pathWithoutQuery === "/courses") {
    return { kind: "home", courseSlug: null, unitSlug: null };
  }

  if (pathWithoutQuery === "/catalog/programs") {
    return { kind: "home", courseSlug: null, unitSlug: null, catalogView: "programs" };
  }

  if (pathWithoutQuery === "/catalog/courses") {
    return { kind: "home", courseSlug: null, unitSlug: null, catalogView: "courses" };
  }

  if (pathWithoutQuery.startsWith("/catalog/")) {
    const segments = pathWithoutQuery.split("/").filter(Boolean);
    const programSlug = decodeURIComponent(segments[1] ?? "").toLowerCase();
    const clusterSlug = segments[2] ? decodeURIComponent(segments[2]).toLowerCase() : null;
    return programSlug
      ? { kind: "home", courseSlug: null, unitSlug: null, programSlug, clusterSlug }
      : { kind: "home", courseSlug: null, unitSlug: null };
  }

  if (pathWithoutQuery === "/settings") {
    return { kind: "settings", courseSlug: null, unitSlug: null };
  }

  if (pathWithoutQuery.startsWith("/programs/")) {
    const segments = pathWithoutQuery.split("/").filter(Boolean);
    const programSlug = decodeURIComponent(segments[1] ?? "").toLowerCase();
    return programSlug
      ? { kind: "program", courseSlug: null, unitSlug: null, programSlug }
      : { kind: "home", courseSlug: null, unitSlug: null };
  }

  if (pathWithoutQuery.startsWith("/courses/")) {
    const segments = pathWithoutQuery.split("/").filter(Boolean);
    const courseSlug = decodeURIComponent(segments[1] ?? "").toLowerCase();
    const unitSlug =
      segments[2] === "units" && segments[3]
        ? decodeURIComponent(segments[3]).toLowerCase()
        : null;

    if (!courseSlug) {
      return { kind: "home", courseSlug: null, unitSlug: null };
    }

    return { kind: "course", courseSlug, unitSlug };
  }

  return { kind: "home", courseSlug: null, unitSlug: null };
}

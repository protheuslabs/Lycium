import type { CourseBookmarkRecord, CourseEntry, CourseSection, RouteInfo } from "../courseTypes";
import {
  DEFAULT_PROGRESS,
  normalizeProgressRecord,
  summarizeCourseProgress,
  type CourseProgressSummary,
} from "./courseProgress";

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
  return `/courses/${getCoursePathSlug(course)}/units/${getSectionPathSlug(section)}`;
}

export function getFirstCourseSection(course: CourseEntry): CourseSection | null {
  return course.data.modules[0]?.sections[0] ?? null;
}

export function getFlatCourseSections(course: CourseEntry): CourseSection[] {
  return course.data.modules.flatMap((module) => module.sections);
}

export function getCourseBookmarkStorageKey(course: CourseEntry): string {
  return `lyceum-bookmark-${course.key}`;
}

export function readStoredCourseBookmark(course: CourseEntry): CourseBookmarkRecord | null {
  try {
    const saved = localStorage.getItem(getCourseBookmarkStorageKey(course));
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

export function writeStoredCourseBookmark(course: CourseEntry, section: CourseSection, path: string): void {
  const bookmark: CourseBookmarkRecord = {
    course_key: course.key,
    course_title: course.title,
    section_id: section.id,
    section_title: section.title,
    path,
  };
  localStorage.setItem(getCourseBookmarkStorageKey(course), JSON.stringify(bookmark));
}

export function findBookmarkedSection(course: CourseEntry, bookmark: CourseBookmarkRecord | null): CourseSection | null {
  if (!bookmark) {
    return null;
  }

  const courseSections = getFlatCourseSections(course);
  return (
    courseSections.find((section) => section.id === bookmark.section_id) ??
    courseSections.find((section) => bookmark.path === getCourseSectionPath(course, section)) ??
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
      if (section.id === bookmark.section_id || bookmark.path === getCourseSectionPath(course, section)) {
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
  const courseStorageKey = `lyceum-progress-${course.key}`;
  const sections = getCourseSectionIds(course);

  try {
    const saved = localStorage.getItem(courseStorageKey);
    const progress = saved ? normalizeProgressRecord(JSON.parse(saved)) : DEFAULT_PROGRESS;
    return summarizeCourseProgress(sections, progress);
  } catch {
    return summarizeCourseProgress(sections, DEFAULT_PROGRESS);
  }
}

export function parseCourseRoute(pathname: string): RouteInfo {
  const pathWithoutQuery = pathname.split("?")[0].replace(/\/+$/, "") || "/";

  if (pathWithoutQuery === "/" || pathWithoutQuery === "/courses") {
    return { kind: "home", courseSlug: null, unitSlug: null };
  }

  if (pathWithoutQuery === "/settings") {
    return { kind: "settings", courseSlug: null, unitSlug: null };
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

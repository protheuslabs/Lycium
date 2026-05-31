import type { LyciumProgram, LyciumRequirementGroup } from "@lycium/contracts";
import type { CourseEntry, CourseSection } from "../courseTypes";

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

export function getProgramPathSlug(program: Pick<LyciumProgram, "id" | "title">): string {
  const base = slugifyCourseTitle(program.title || "program");
  return `${base}-${program.id}`;
}

export function getProgramClusterPathSlug(cluster: Pick<LyciumRequirementGroup, "id" | "displayName">): string {
  const base = slugifyCourseTitle(cluster.displayName || "cluster");
  return `${base}-${cluster.id}`;
}

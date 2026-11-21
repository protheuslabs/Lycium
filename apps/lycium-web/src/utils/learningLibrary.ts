import type { CourseBookmarkRecord, CourseEntry, CourseProgressRecord } from "../courseTypes";
import { getCourseCategoryLabel, getCourseDepartmentLabel } from "@lycium/contracts";
import { normalizeProgressRecord, summarizeCourseProgress, resolveSectionStatuses } from "./courseProgress";
import { findBookmarkedSection, getFlatCourseSections } from "./courseRouting";
import { getCourseLifecycleSummary } from "./courseLifecycle";

export type LearningRecord = {
  progress: CourseProgressRecord | null;
  bookmark: CourseBookmarkRecord | null;
};

export function buildLearningLibrary(
  courses: CourseEntry[],
  records: Record<string, LearningRecord>,
) {
  const items = courses.flatMap((course) => {
    const sections = getFlatCourseSections(course);
    if (!sections.length || !getCourseLifecycleSummary(course).canOpen) return [];
    const record = records[course.key];
    const progressRecord = normalizeProgressRecord(record?.progress);
    const progress = summarizeCourseProgress(sections, progressRecord);
    const bookmark = findBookmarkedSection(course, record?.bookmark ?? null);
    return [
      {
        course,
        progress,
        sectionStatuses: resolveSectionStatuses(sections, progressRecord.completedSectionIds, progressRecord.sectionStatuses, course.data.orderMandatory ?? false),
        bookmark,
        department: course.data.department
          ? getCourseDepartmentLabel(course.data.category, course.data.department)
          : course.data.category
            ? getCourseCategoryLabel(course.data.category).replace(/^College of /, "")
            : "Independent study",
        started: progress.viewed > 0 || Boolean(bookmark),
        completed: progress.completed === progress.total,
      },
    ];
  });
  return {
    items,
    active: items.filter((item) => item.started && !item.completed),
    completed: items.filter((item) => item.completed),
    completedSections: items.reduce((total, item) => total + item.progress.completed, 0),
  };
}

export type LearningCourse = ReturnType<typeof buildLearningLibrary>["items"][number];
export type LearningLibrary = ReturnType<typeof buildLearningLibrary>;

export type LearningView = "active" | "completed" | "all";
export type LearningSort = "title" | "progress";

export function selectLearningCourses(library: LearningLibrary, view: LearningView, query: string, subject: string, sort: LearningSort) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const source = view === "active" ? library.active : view === "completed" ? library.completed : library.items;
  return source.filter((item) => {
    const searchableText = `${item.course.title} ${item.course.data.shortDescription ?? ""} ${item.department}`.toLocaleLowerCase();
    return (!normalizedQuery || searchableText.includes(normalizedQuery)) && (subject === "all" || item.department === subject);
  }).sort((a, b) => sort === "progress"
    ? b.progress.percentage - a.progress.percentage || a.course.title.localeCompare(b.course.title)
    : a.course.title.localeCompare(b.course.title));
}

export function selectDiscoveryCourses(items: LearningCourse[], category: string, limit = 4) {
  const candidates = items
    .filter(({ course }) => category === "all" || course.data.category === category)
    .sort(
      (a, b) => Number(b.course.status === "published") - Number(a.course.status === "published"),
    );
  const subjects = new Set<string>();
  const diverse = candidates.filter((item) => {
    if (subjects.has(item.department)) return false;
    subjects.add(item.department);
    return true;
  });
  const included = new Set(diverse.map((item) => item.course.key));
  return [...diverse, ...candidates.filter((item) => !included.has(item.course.key))].slice(
    0,
    limit,
  );
}

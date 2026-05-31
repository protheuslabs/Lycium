import type { CourseEntry } from "../../courseTypes";
import { getCourseProgress } from "../../utils/courseRouting";

type CoursePrerequisiteLike = NonNullable<CourseEntry["data"]["prerequisites"]>[number] | string;

function getPrerequisiteCourseId(prerequisite: CoursePrerequisiteLike): string | null {
  if (typeof prerequisite === "string") {
    return prerequisite;
  }

  if (prerequisite.type !== "course") {
    return null;
  }

  return prerequisite.courseId ?? prerequisite.id ?? null;
}

function getPrerequisiteTitle(prerequisite: CoursePrerequisiteLike, prerequisiteCourse: CourseEntry | undefined): string {
  if (typeof prerequisite === "string") {
    return prerequisiteCourse?.title ?? prerequisite;
  }

  return prerequisite.title ?? prerequisiteCourse?.title ?? prerequisite.courseId ?? prerequisite.id ?? "required course";
}

export function getUnmetCoursePrerequisites(course: CourseEntry, courseMap: Map<string, CourseEntry>): string[] {
  return (course.data.prerequisites ?? [])
    .map((prerequisite) => {
      const prerequisiteCourseId = getPrerequisiteCourseId(prerequisite);

      if (!prerequisiteCourseId) {
        return null;
      }

      const prerequisiteCourse = courseMap.get(prerequisiteCourseId);
      const prerequisiteProgress = prerequisiteCourse ? getCourseProgress(prerequisiteCourse) : null;
      const isMet = Boolean(prerequisiteProgress && prerequisiteProgress.percentage >= 100);

      return isMet ? null : getPrerequisiteTitle(prerequisite, prerequisiteCourse);
    })
    .filter((title): title is string => Boolean(title));
}

import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { CourseEntry } from "../courseTypes";
import { queueCourseSourceGapSuggestion } from "../utils/courseSourceGaps";

type UseCourseSourceGapActionsArgs = {
  setCourses: Dispatch<SetStateAction<CourseEntry[]>>;
};

export function useCourseSourceGapActions({ setCourses }: UseCourseSourceGapActionsArgs) {
  const queueCourseSourceGap = useCallback((course: CourseEntry, gapId: string, url: string, description: string) => {
    setCourses((currentCourses) =>
      currentCourses.map((currentCourse) =>
        currentCourse.key === course.key
          ? queueCourseSourceGapSuggestion(currentCourse, { gapId, url, description })
          : currentCourse,
      ),
    );
  }, [setCourses]);

  return { queueCourseSourceGap };
}

import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { CourseEntry } from "../courseTypes";
import { browserStorage } from "../runtime/appRuntime";
import { buildLearningLibrary, type LearningRecord } from "../utils/learningLibrary";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener("focus", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("focus", onChange);
  };
}

export function useLearningLibrary(courses: CourseEntry[]) {
  const getSnapshot = useCallback(
    () =>
      JSON.stringify(
        Object.fromEntries(
          courses.map((course) => [
            course.key,
            {
              progress: browserStorage.readProgress(course.key),
              bookmark: browserStorage.readBookmark(course.key),
            },
          ]),
        ),
      ),
    [courses],
  );
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => "{}");
  return useMemo(
    () => buildLearningLibrary(courses, JSON.parse(snapshot) as Record<string, LearningRecord>),
    [courses, snapshot],
  );
}

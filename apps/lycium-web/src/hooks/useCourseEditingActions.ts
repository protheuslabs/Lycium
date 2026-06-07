import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { CourseData, CourseEntry } from "../courseTypes";
import {
  createLocalCourseFork,
  createManualCourseDraft,
  deletePersistedLocalCourseDraft,
  exportLocalCourseDraftToJson,
  getLocalDraftMetadata,
  importLocalCourseDraftFromJson,
  persistLocalCourseDraft,
  saveLocalCourseDraftConflictSafe,
} from "../utils/localCourseDrafts";

type UseCourseEditingActionsArgs = {
  setCourses: Dispatch<SetStateAction<CourseEntry[]>>;
  openCourseByEntry: (course: CourseEntry, replace?: boolean) => Promise<void>;
};

function safeDraftFilename(course: CourseEntry): string {
  const stem = course.title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);

  return `${stem || "lycium-course-draft"}.lycium-draft.json`;
}

export function useCourseEditingActions({ setCourses, openCourseByEntry }: UseCourseEditingActionsArgs) {
  const saveCourseDraft = useCallback(
    (courseKey: string, data: CourseData) => {
      let conflictCourseToOpen: CourseEntry | null = null;

      setCourses((currentCourses) => {
        const course = currentCourses.find((currentCourse) => currentCourse.key === courseKey);
        if (!course) {
          return currentCourses;
        }

        const saveResult = saveLocalCourseDraftConflictSafe(course, data);
        if (!saveResult.conflictDetected) {
          return currentCourses.map((currentCourse) =>
            currentCourse.key === courseKey ? saveResult.course : currentCourse,
          );
        }

        conflictCourseToOpen = saveResult.course;
        const retainedCourses = currentCourses.filter(
          (currentCourse) =>
            currentCourse.key !== courseKey &&
            currentCourse.key !== saveResult.course.key &&
            currentCourse.key !== saveResult.persistedCourse?.key,
        );

        return [saveResult.course, saveResult.persistedCourse ?? course, ...retainedCourses];
      });

      queueMicrotask(() => {
        if (conflictCourseToOpen) {
          void openCourseByEntry(conflictCourseToOpen, true);
        }
      });
    },
    [openCourseByEntry, setCourses],
  );

  const forkCourse = useCallback(
    (course: CourseEntry) => {
      const fork = createLocalCourseFork(course);

      setCourses((currentCourses) => [fork, ...currentCourses]);
      persistLocalCourseDraft(fork);
      void openCourseByEntry(fork);
    },
    [openCourseByEntry, setCourses],
  );

  const createManualCourse = useCallback(() => {
    const course = createManualCourseDraft();
    persistLocalCourseDraft(course);
    setCourses((currentCourses) => [course, ...currentCourses]);
    void openCourseByEntry(course);
  }, [openCourseByEntry, setCourses]);

  const deleteCourseDraft = useCallback(
    (course: CourseEntry) => {
      deletePersistedLocalCourseDraft(course.key);
      setCourses((currentCourses) => currentCourses.filter((currentCourse) => currentCourse.key !== course.key));
    },
    [setCourses],
  );

  const resetCourseDraft = useCallback(
    (course: CourseEntry) => {
      const draft = getLocalDraftMetadata(course);
      deletePersistedLocalCourseDraft(course.key);
      let targetCourse: CourseEntry | null = null;
      setCourses((currentCourses) => {
        const nextCourses = currentCourses.filter((currentCourse) => currentCourse.key !== course.key);
        targetCourse = nextCourses.find((currentCourse) => currentCourse.key === draft?.parentCourseKey) ?? nextCourses[0] ?? null;
        return nextCourses;
      });
      queueMicrotask(() => {
        if (targetCourse) {
          void openCourseByEntry(targetCourse, true);
        }
      });
    },
    [openCourseByEntry, setCourses],
  );

  const exportCourseDraft = useCallback((course: CourseEntry) => {
    const blob = new Blob([exportLocalCourseDraftToJson(course)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = safeDraftFilename(course);
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, []);

  const importCourseDraft = useCallback(
    async (file: File) => {
      try {
        const importedCourse = importLocalCourseDraftFromJson(await file.text());
        persistLocalCourseDraft(importedCourse);
        setCourses((currentCourses) => [
          importedCourse,
          ...currentCourses.filter((currentCourse) => currentCourse.key !== importedCourse.key),
        ]);
        void openCourseByEntry(importedCourse);
      } catch (error) {
        window.alert(error instanceof Error ? error.message : "Unable to import local draft.");
      }
    },
    [openCourseByEntry, setCourses],
  );

  return {
    createManualCourse,
    deleteCourseDraft,
    exportCourseDraft,
    forkCourse,
    importCourseDraft,
    resetCourseDraft,
    saveCourseDraft,
  };
}

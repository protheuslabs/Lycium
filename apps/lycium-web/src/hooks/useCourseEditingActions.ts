import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { CourseData, CourseEntry } from "../courseTypes";

type UseCourseEditingActionsArgs = {
  setCourses: Dispatch<SetStateAction<CourseEntry[]>>;
  openCourseByEntry: (course: CourseEntry, replace?: boolean) => Promise<void>;
};

export function useCourseEditingActions({ setCourses, openCourseByEntry }: UseCourseEditingActionsArgs) {
  const saveCourseDraft = useCallback(
    (courseKey: string, data: CourseData) => {
      setCourses((currentCourses) =>
        currentCourses.map((course) =>
          course.key === courseKey
            ? {
                ...course,
                title: data.title,
                data,
                status: course.status === "published" ? "draft" : course.status,
              }
            : course,
        ),
      );
    },
    [setCourses],
  );

  const forkCourse = useCallback(
    (course: CourseEntry) => {
      const forkTitle = `Fork of ${course.title}`;
      const forkData = JSON.parse(JSON.stringify(course.data)) as CourseData;
      forkData.title = forkTitle;
      forkData.metadata = {
        ...(forkData.metadata ?? {}),
        editPolicy: {
          ...((forkData.metadata?.editPolicy as Record<string, unknown> | undefined) ?? {}),
          editable: true,
          ownerCanEdit: true,
          learnersCanFork: true,
        },
      };

      const fork: CourseEntry = {
        ...course,
        key: `${course.key}-fork-${Date.now().toString(36)}`,
        title: forkTitle,
        source: "local",
        status: "draft",
        snapshotId: undefined,
        generation_trace: undefined,
        data: forkData,
      };

      setCourses((currentCourses) => [fork, ...currentCourses]);
      void openCourseByEntry(fork);
    },
    [openCourseByEntry, setCourses],
  );

  return {
    forkCourse,
    saveCourseDraft,
  };
}

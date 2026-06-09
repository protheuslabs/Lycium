import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { LyciumGeneratedCourseRecord } from "@lycium/contracts";
import type { CourseData, CourseEntry } from "../courseTypes";
import { courseAllowsLocalEdit } from "../components/CourseEditing/courseEditPrimitives";
import { browserStorage, lyciumApi } from "../runtime/appRuntime";
import { getCourseSectionPath } from "../utils/courseRouting";
import { mergeCourseEntriesByKey } from "../utils/localCourseDrafts";

export type SectionRegenerationRequest = {
  course: CourseEntry;
  moduleId: string;
  sectionId: string;
  feedback?: string;
  positiveFeedback?: string[];
  negativeFeedback?: string[];
  newSourceUrls?: string[];
  badSourceIds?: string[];
};

type UseCourseSectionRegenerationActionsProps = {
  learnerId: number | null;
  activeAiReady: boolean;
  aiLockedReason: string;
  openCourseByEntry: (course: CourseEntry, replace?: boolean) => Promise<void>;
  setCourses: Dispatch<SetStateAction<CourseEntry[]>>;
};

function courseEntryFromGeneratedRecord(record: LyciumGeneratedCourseRecord): CourseEntry {
  return {
    key: `remote-${record.id}`,
    title: record.title,
    data: record.structure as CourseData,
    source: "remote",
    snapshotId: Number(record.id),
    status: record.status,
  };
}

export function useCourseSectionRegenerationActions({
  learnerId,
  activeAiReady,
  aiLockedReason,
  openCourseByEntry,
  setCourses,
}: UseCourseSectionRegenerationActionsProps) {
  const regenerateCourseSection = useCallback(
    async ({
      course,
      moduleId,
      sectionId,
      feedback,
      positiveFeedback = [],
      negativeFeedback = [],
      newSourceUrls = [],
      badSourceIds = [],
    }: SectionRegenerationRequest) => {
      if (!course.snapshotId) {
        throw new Error("Section refresh needs an API-backed course snapshot.");
      }
      if (!activeAiReady) {
        throw new Error(aiLockedReason || "Connect and verify an active AI model before refreshing a section.");
      }

      const record = await lyciumApi.regenerateCourseSection(course.snapshotId, {
        module_id: moduleId,
        section_id: sectionId,
        learner_id: learnerId,
        feedback: feedback?.trim() || null,
        positive_feedback: positiveFeedback,
        negative_feedback: negativeFeedback,
        new_source_urls: newSourceUrls,
        bad_source_ids: badSourceIds,
        fork_if_read_only: !courseAllowsLocalEdit(course),
      });
      const updatedCourse = courseEntryFromGeneratedRecord(record);
      const refreshedSection = updatedCourse.data.modules
        .flatMap((module) => module.sections)
        .find((section) => section.id === sectionId);
      if (refreshedSection) {
        browserStorage.writeBookmark(updatedCourse.key, {
          course_key: updatedCourse.key,
          course_title: updatedCourse.title,
          section_id: refreshedSection.id,
          section_title: refreshedSection.title,
          path: getCourseSectionPath(updatedCourse, refreshedSection),
        });
      }
      setCourses((current) => mergeCourseEntriesByKey([updatedCourse], current));
      await openCourseByEntry(updatedCourse, true);
      return updatedCourse;
    },
    [activeAiReady, aiLockedReason, learnerId, openCourseByEntry, setCourses],
  );

  return { regenerateCourseSection };
}

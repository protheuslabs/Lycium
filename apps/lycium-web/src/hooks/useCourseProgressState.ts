import { useCallback, useEffect, useMemo, useState } from "react";
import { browserStorage, lyciumApi } from "../runtime/appRuntime";
import type { CourseEntry, CourseProgressRecord, CourseSection, SectionStatus } from "../courseTypes";
import {
  areProgressRecordsEqual,
  DEFAULT_PROGRESS,
  normalizeCompletedSectionIds,
  normalizeProgressRecord,
  normalizeSectionStatuses,
  resolveSectionStatuses,
} from "../utils/courseProgress";

type UseCourseProgressStateOptions = {
  selectedCourse?: CourseEntry | null;
  sections: CourseSection[];
  orderMandatory: boolean;
  learnerId: number | null;
  currentSectionId?: string | null;
};

export function useCourseProgressState({
  selectedCourse,
  sections,
  orderMandatory,
  learnerId,
  currentSectionId,
}: UseCourseProgressStateOptions) {
  const [progress, setProgress] = useState<CourseProgressRecord>(DEFAULT_PROGRESS);

  const normalizeProgressForCourse = useCallback(
    (candidate: CourseProgressRecord): CourseProgressRecord => {
      const normalizedCompletedIds = normalizeCompletedSectionIds(candidate.completedSectionIds);
      const normalizedStatuses = normalizeSectionStatuses(candidate.sectionStatuses);
      const resolvedStatuses = resolveSectionStatuses(
        sections,
        normalizedCompletedIds,
        normalizedStatuses,
        Boolean(orderMandatory),
      );

      return {
        completedSectionIds: normalizedCompletedIds,
        sectionStatuses: resolvedStatuses,
      };
    },
    [orderMandatory, sections],
  );

  const persistProgress = useCallback(
    (nextProgress: CourseProgressRecord, sectionId?: string | null) => {
      const courseKey = selectedCourse?.key ?? "unknown";
      browserStorage.writeProgress(courseKey, nextProgress);
      lyciumApi
        .mirrorCompletion({
          course_key: courseKey,
          course_title: selectedCourse?.title ?? null,
          section_id: sectionId ?? null,
          completed_section_ids: nextProgress.completedSectionIds,
          section_statuses: nextProgress.sectionStatuses,
        })
        .catch((err) => console.warn("Failed to mirror local completion:", err));
    },
    [selectedCourse?.key, selectedCourse?.title],
  );

  const resolvedSectionStatuses = useMemo(
    () => resolveSectionStatuses(sections, progress.completedSectionIds, progress.sectionStatuses, Boolean(orderMandatory)),
    [orderMandatory, progress.completedSectionIds, progress.sectionStatuses, sections],
  );

  const completedSectionIds = useMemo(() => new Set(progress.completedSectionIds), [progress.completedSectionIds]);

  const handleSectionTimedStatusChange = useCallback(
    (sectionId: string, hasTimedQuizInProgress: boolean) => {
      setProgress((prev) => {
        if (prev.completedSectionIds.includes(sectionId)) {
          return prev;
        }

        const targetStatus: SectionStatus = hasTimedQuizInProgress ? "timed" : "seen";
        if (prev.sectionStatuses[sectionId] === targetStatus) {
          return prev;
        }

        const nextProgress = normalizeProgressForCourse({
          completedSectionIds: prev.completedSectionIds,
          sectionStatuses: { ...prev.sectionStatuses, [sectionId]: targetStatus },
        });

        if (areProgressRecordsEqual(prev, nextProgress)) {
          return prev;
        }

        persistProgress(nextProgress, sectionId);
        return nextProgress;
      });
    },
    [normalizeProgressForCourse, persistProgress],
  );

  const handleCompleteSection = useCallback(
    (sectionId: string) => {
      setProgress((prev) => {
        const completedSectionIds = Array.from(new Set([...prev.completedSectionIds, sectionId]));
        const nextProgress = normalizeProgressForCourse({
          completedSectionIds,
          sectionStatuses: { ...prev.sectionStatuses, [sectionId]: "completed" },
        });

        if (areProgressRecordsEqual(prev, nextProgress)) {
          return prev;
        }

        persistProgress(nextProgress, sectionId);
        return nextProgress;
      });

      if (selectedCourse?.snapshotId && learnerId) {
        lyciumApi
          .saveSnapshotProgress(selectedCourse.snapshotId, {
            learner_id: learnerId,
            section_id: sectionId,
            completion_state: "completed",
            mastery_score: 0.8,
            event_type: "section_completed",
            event_payload: { course_key: selectedCourse.key },
          })
          .catch((err) => console.warn("Failed to post progress:", err));
      }
    },
    [learnerId, normalizeProgressForCourse, persistProgress, selectedCourse?.key, selectedCourse?.snapshotId],
  );

  useEffect(() => {
    let initialProgress = DEFAULT_PROGRESS;
    try {
      initialProgress = selectedCourse?.key
        ? normalizeProgressRecord(browserStorage.readProgress(selectedCourse.key))
        : DEFAULT_PROGRESS;
    } catch {
      initialProgress = DEFAULT_PROGRESS;
    }

    const normalizedInitialProgress = normalizeProgressForCourse(initialProgress);
    setProgress(normalizedInitialProgress);
    if (!selectedCourse?.key) {
      return;
    }

    lyciumApi
      .loadCompletion(selectedCourse.key)
      .then((storedProgress) => {
        const normalizedStoredProgress = normalizeProgressRecord(storedProgress);
        const merged = normalizeProgressForCourse({
          completedSectionIds: [
            ...normalizedInitialProgress.completedSectionIds,
            ...normalizedStoredProgress.completedSectionIds,
          ],
          sectionStatuses: {
            ...normalizedInitialProgress.sectionStatuses,
            ...normalizedStoredProgress.sectionStatuses,
          },
        });

        if (areProgressRecordsEqual(normalizedInitialProgress, merged)) {
          return;
        }

        browserStorage.writeProgress(selectedCourse.key, merged);
        setProgress(merged);
      })
      .catch((err) => console.warn("Local completion unavailable:", err));
  }, [normalizeProgressForCourse, selectedCourse?.key]);

  useEffect(() => {
    if (!currentSectionId) {
      return;
    }

    setProgress((prev) => {
      if (prev.completedSectionIds.includes(currentSectionId)) {
        return prev;
      }

      const currentStatus = prev.sectionStatuses[currentSectionId];
      if (currentStatus === "seen" || currentStatus === "timed") {
        return prev;
      }

      const nextProgress = normalizeProgressForCourse({
        completedSectionIds: prev.completedSectionIds,
        sectionStatuses: { ...prev.sectionStatuses, [currentSectionId]: "seen" },
      });

      if (areProgressRecordsEqual(prev, nextProgress)) {
        return prev;
      }

      persistProgress(nextProgress, currentSectionId);
      return nextProgress;
    });
  }, [currentSectionId, normalizeProgressForCourse, persistProgress]);

  return {
    progress,
    resolvedSectionStatuses,
    completedSectionIds,
    handleSectionTimedStatusChange,
    handleCompleteSection,
  };
}

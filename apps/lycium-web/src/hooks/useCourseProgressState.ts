import { useCallback, useEffect, useMemo, useState } from "react";
import { browserStorage, lyciumApi } from "../runtime/appRuntime";
import type { CourseEntry, CourseProgressRecord, CourseSection, SectionStatus } from "../courseTypes";
import {
  areProgressRecordsEqual,
  DEFAULT_PROGRESS,
  normalizeCompletedSectionIds,
  normalizeProgressRecord,
  normalizeSectionStatuses,
  resolveSectionStatusTransition,
  resolveSectionStatuses,
} from "../utils/courseProgress";

type UseCourseProgressStateOptions = {
  selectedCourse?: CourseEntry | null;
  sections: CourseSection[];
  orderMandatory: boolean;
  learnerId: number | null;
  currentSectionId?: string | null;
};

type CourseProgressState = {
  courseKey: string | null;
  progress: CourseProgressRecord;
};

const courseProgressCache = new Map<string, CourseProgressRecord>();

function readCachedCourseProgress(courseKey: string | null): CourseProgressRecord {
  if (!courseKey) {
    return DEFAULT_PROGRESS;
  }

  const cachedProgress = courseProgressCache.get(courseKey);
  if (cachedProgress) {
    return cachedProgress;
  }

  try {
    const storedProgress = normalizeProgressRecord(browserStorage.readProgress(courseKey));
    courseProgressCache.set(courseKey, storedProgress);
    return storedProgress;
  } catch {
    return DEFAULT_PROGRESS;
  }
}

function cacheCourseProgress(courseKey: string, progress: CourseProgressRecord): void {
  courseProgressCache.set(courseKey, progress);
  browserStorage.writeProgress(courseKey, progress);
}

export function useCourseProgressState({
  selectedCourse,
  sections,
  orderMandatory,
  learnerId,
  currentSectionId,
}: UseCourseProgressStateOptions) {
  const courseKey = selectedCourse?.key ?? null;
  const [progressState, setProgressState] = useState<CourseProgressState>(() => ({
    courseKey,
    progress: readCachedCourseProgress(courseKey),
  }));

  const normalizeProgressForCourse = useCallback(
    (candidate: CourseProgressRecord): CourseProgressRecord => {
      const sectionIds = new Set(sections.map((section) => section.id));
      const normalizedCompletedIds = normalizeCompletedSectionIds(candidate.completedSectionIds).filter((sectionId) =>
        sectionIds.has(sectionId),
      );
      const completedSet = new Set(normalizedCompletedIds);
      const normalizedStatuses = normalizeSectionStatuses(candidate.sectionStatuses);
      const sectionStatuses: Record<string, SectionStatus> = {};

      for (const [sectionId, status] of Object.entries(normalizedStatuses)) {
        if (!sectionIds.has(sectionId) || status === "locked" || completedSet.has(sectionId)) {
          continue;
        }

        if (status === "seen" || status === "timed") {
          sectionStatuses[sectionId] = status;
        }
      }

      for (const sectionId of normalizedCompletedIds) {
        sectionStatuses[sectionId] = "completed";
      }

      return {
        completedSectionIds: normalizedCompletedIds,
        sectionStatuses,
      };
    },
    [sections],
  );

  const sourceProgress =
    progressState.courseKey === courseKey ? progressState.progress : readCachedCourseProgress(courseKey);
  const visibleProgress = useMemo(
    () => normalizeProgressForCourse(sourceProgress),
    [normalizeProgressForCourse, sourceProgress],
  );

  const persistProgress = useCallback(
    (nextProgress: CourseProgressRecord, sectionId?: string | null) => {
      if (!courseKey) {
        return;
      }

      cacheCourseProgress(courseKey, nextProgress);
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
    [courseKey, selectedCourse?.title],
  );

  const resolvedSectionStatuses = useMemo(
    () =>
      resolveSectionStatuses(
        sections,
        visibleProgress.completedSectionIds,
        visibleProgress.sectionStatuses,
        Boolean(orderMandatory),
      ),
    [orderMandatory, sections, visibleProgress.completedSectionIds, visibleProgress.sectionStatuses],
  );

  const completedSectionIds = useMemo(
    () => new Set(visibleProgress.completedSectionIds),
    [visibleProgress.completedSectionIds],
  );

  const handleSectionTimedStatusChange = useCallback(
    (sectionId: string, hasTimedQuizInProgress: boolean) => {
      if (!courseKey) {
        return;
      }

      setProgressState((prev) => {
        const baseProgress = normalizeProgressForCourse(
          prev.courseKey === courseKey ? prev.progress : readCachedCourseProgress(courseKey),
        );
        if (baseProgress.completedSectionIds.includes(sectionId)) {
          return prev;
        }

        const targetStatus: SectionStatus = hasTimedQuizInProgress ? "timed" : "seen";
        const nextStatus = resolveSectionStatusTransition(baseProgress.sectionStatuses[sectionId], targetStatus);
        if (baseProgress.sectionStatuses[sectionId] === nextStatus) {
          return prev;
        }

        const nextProgress = normalizeProgressForCourse({
          completedSectionIds: baseProgress.completedSectionIds,
          sectionStatuses: { ...baseProgress.sectionStatuses, [sectionId]: nextStatus },
        });

        if (areProgressRecordsEqual(baseProgress, nextProgress)) {
          return prev;
        }

        persistProgress(nextProgress, sectionId);
        return { courseKey, progress: nextProgress };
      });
    },
    [courseKey, normalizeProgressForCourse, persistProgress],
  );

  const handleCompleteSection = useCallback(
    (sectionId: string) => {
      if (!courseKey) {
        return;
      }

      setProgressState((prev) => {
        const baseProgress = normalizeProgressForCourse(
          prev.courseKey === courseKey ? prev.progress : readCachedCourseProgress(courseKey),
        );
        const completedSectionIds = Array.from(new Set([...baseProgress.completedSectionIds, sectionId]));
        const nextProgress = normalizeProgressForCourse({
          completedSectionIds,
          sectionStatuses: { ...baseProgress.sectionStatuses, [sectionId]: "completed" },
        });

        if (areProgressRecordsEqual(baseProgress, nextProgress)) {
          return prev;
        }

        persistProgress(nextProgress, sectionId);
        return { courseKey, progress: nextProgress };
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
    [courseKey, learnerId, normalizeProgressForCourse, persistProgress, selectedCourse?.key, selectedCourse?.snapshotId],
  );

  useEffect(() => {
    const normalizedInitialProgress = normalizeProgressForCourse(readCachedCourseProgress(courseKey));
    setProgressState((prev) =>
      prev.courseKey === courseKey && areProgressRecordsEqual(prev.progress, normalizedInitialProgress)
        ? prev
        : { courseKey, progress: normalizedInitialProgress },
    );
    if (!courseKey) {
      return;
    }

    lyciumApi
      .loadCompletion(courseKey)
      .then((storedProgress) => {
        const normalizedStoredProgress = normalizeProgressRecord(storedProgress);
        const completedSectionIds = [
          ...normalizedInitialProgress.completedSectionIds,
          ...normalizedStoredProgress.completedSectionIds,
        ];
        const sectionStatuses = { ...normalizedInitialProgress.sectionStatuses };

        for (const [sectionId, status] of Object.entries(normalizedStoredProgress.sectionStatuses)) {
          sectionStatuses[sectionId] = resolveSectionStatusTransition(sectionStatuses[sectionId], status);
        }

        for (const sectionId of completedSectionIds) {
          sectionStatuses[sectionId] = "completed";
        }

        const merged = normalizeProgressForCourse({
          completedSectionIds,
          sectionStatuses,
        });

        if (areProgressRecordsEqual(normalizedInitialProgress, merged)) {
          return;
        }

        cacheCourseProgress(courseKey, merged);
        setProgressState((prev) =>
          prev.courseKey === courseKey && areProgressRecordsEqual(prev.progress, merged)
            ? prev
            : { courseKey, progress: merged },
        );
      })
      .catch((err) => console.warn("Local completion unavailable:", err));
  }, [courseKey, normalizeProgressForCourse]);

  useEffect(() => {
    if (!courseKey || !currentSectionId) {
      return;
    }

    setProgressState((prev) => {
      const baseProgress = normalizeProgressForCourse(
        prev.courseKey === courseKey ? prev.progress : readCachedCourseProgress(courseKey),
      );
      if (baseProgress.completedSectionIds.includes(currentSectionId)) {
        return prev;
      }

      const currentStatus = baseProgress.sectionStatuses[currentSectionId];
      const nextStatus = resolveSectionStatusTransition(currentStatus, "seen");
      if (currentStatus === nextStatus) {
        return prev;
      }

      const nextProgress = normalizeProgressForCourse({
        completedSectionIds: baseProgress.completedSectionIds,
        sectionStatuses: { ...baseProgress.sectionStatuses, [currentSectionId]: nextStatus },
      });

      if (areProgressRecordsEqual(baseProgress, nextProgress)) {
        return prev;
      }

      persistProgress(nextProgress, currentSectionId);
      return { courseKey, progress: nextProgress };
    });
  }, [courseKey, currentSectionId, normalizeProgressForCourse, persistProgress]);

  return {
    progress: visibleProgress,
    resolvedSectionStatuses,
    completedSectionIds,
    handleSectionTimedStatusChange,
    handleCompleteSection,
  };
}

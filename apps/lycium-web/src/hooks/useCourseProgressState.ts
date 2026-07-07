import { useCallback, useEffect, useMemo, useState } from "react";
import { browserStorage, localApiSyncEnabled, lyciumApi } from "../runtime/appRuntime";
import type { CourseEntry, CourseProgressRecord, CourseSection, SectionStatus } from "../courseTypes";
import {
  areProgressRecordsEqual,
  DEFAULT_PROGRESS,
  markSectionSeen,
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

  const cachedProgress = readCachedCourseProgress(courseKey);
  const sourceProgress =
    progressState.courseKey === courseKey && areProgressRecordsEqual(progressState.progress, cachedProgress)
      ? progressState.progress
      : cachedProgress;
  const visibleProgress = useMemo(
    () => markSectionSeen(normalizeProgressForCourse(sourceProgress), currentSectionId),
    [currentSectionId, normalizeProgressForCourse, sourceProgress],
  );

  const persistProgress = useCallback(
    (nextProgress: CourseProgressRecord, sectionId?: string | null) => {
      if (!courseKey) {
        return;
      }

      cacheCourseProgress(courseKey, nextProgress);
      if (localApiSyncEnabled) {
        lyciumApi
          .mirrorCompletion({
            course_key: courseKey,
            course_title: selectedCourse?.title ?? null,
            section_id: sectionId ?? null,
            completed_section_ids: nextProgress.completedSectionIds,
            section_statuses: nextProgress.sectionStatuses,
          })
          .catch((err) => console.warn("Failed to mirror local completion:", err));
      }
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

      if (localApiSyncEnabled && selectedCourse?.snapshotId && learnerId) {
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
    [courseKey, learnerId, normalizeProgressForCourse, persistProgress, selectedCourse],
  );

  useEffect(() => {
    const normalizedInitialProgress = normalizeProgressForCourse(readCachedCourseProgress(courseKey));
    if (!courseKey || !localApiSyncEnabled) {
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
    const persistedProgress = normalizeProgressForCourse(readCachedCourseProgress(courseKey));
    if (!areProgressRecordsEqual(persistedProgress, visibleProgress)) {
      persistProgress(visibleProgress, currentSectionId);
    }
  }, [courseKey, currentSectionId, normalizeProgressForCourse, persistProgress, visibleProgress]);

  return {
    progress: visibleProgress,
    resolvedSectionStatuses,
    completedSectionIds,
    handleSectionTimedStatusChange,
    handleCompleteSection,
  };
}

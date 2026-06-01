
"use client";

import { useCallback, useState } from "react";
import type { Dispatch, FormEvent, SetStateAction } from "react";
import sourceRecordsData from "../courseData/sourceRecords";
import type { CourseEntry } from "../courseTypes";
import { lyciumApi } from "../runtime/appRuntime";
import { formatCourseValidationErrors, validateCourseEntry } from "../utils/courseValidation";
import {
  DEFAULT_SOURCE_COVERAGE_POLICY,
  createSourceGapDraftCourse,
  sourceCountMeetsMinimum,
  submittedSourceCount,
} from "../utils/courseSourceGaps";

type CourseClassification = {
  category: string;
  department: string;
};

type UseCourseGenerationActionsArgs = {
  prompt: string;
  level: string;
  learnerId: number | null;
  activeAiReady: boolean;
  setCourses: Dispatch<SetStateAction<CourseEntry[]>>;
  setPrompt: Dispatch<SetStateAction<string>>;
  openCourseByEntry: (course: CourseEntry, replace?: boolean) => void | Promise<void>;
};

export function useCourseGenerationActions({
  prompt,
  level,
  learnerId,
  activeAiReady,
  setCourses,
  setPrompt,
  openCourseByEntry,
}: UseCourseGenerationActionsArgs) {
  const [generateStatus, setGenerateStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [generateMessage, setGenerateMessage] = useState("");
  const [publishingCourseKey, setPublishingCourseKey] = useState<string | null>(null);

  const handleGenerateCourse = async (
    evt: FormEvent<HTMLFormElement>,
    sourceLinks: string[] = [],
    classification?: CourseClassification,
  ) => {
    evt.preventDefault();
    if (!activeAiReady) {
      setGenerateStatus("error");
      setGenerateMessage("Connect and verify an active AI model before generating a course.");
      return;
    }
    if (!prompt.trim() || !classification?.category || !classification.department) return;
    if (!sourceCountMeetsMinimum(sourceLinks)) {
      const draft = createSourceGapDraftCourse({ prompt, level, sourceLinks, classification });
      setCourses((prev) => [draft, ...prev]);
      setPrompt("");
      setGenerateStatus("success");
      setGenerateMessage(
        `Course draft needs more sources: ${submittedSourceCount(sourceLinks)}/${DEFAULT_SOURCE_COVERAGE_POLICY.minimumCourseSources} minimum sources attached.`,
      );
      return;
    }
    setGenerateStatus("loading");
    setGenerateMessage("Starting course generation...");

    try {
      let job = await lyciumApi.createCourseGenerationJob({
        prompt,
        learner_id: learnerId ?? undefined,
        level: level || undefined,
        source_policy: "balanced",
        category: classification.category,
        department: classification.department,
        desired_module_count: 12,
        expected_duration_minutes: 2700,
        source_urls: sourceLinks,
      });
      while (job.status === "queued" || job.status === "running") {
        const percent = Math.round((job.progress ?? 0) * 100);
        setGenerateMessage(`${percent}% · ${job.message || job.current_stage || "Generating course..."}`);
        await new Promise((resolve) => window.setTimeout(resolve, 2500));
        job = await lyciumApi.getCourseGenerationJob(job.id);
      }

      if (job.status === "failed") {
        throw new Error(job.error || job.message || "Course generation failed.");
      }

      const generatedSnapshot = job.course_snapshot;
      if (!generatedSnapshot?.structure) {
        throw new Error("Course generation finished without a ready course snapshot.");
      }

      const entry: CourseEntry = {
        key: `remote-${generatedSnapshot.id}`,
        title: generatedSnapshot.title,
        data: generatedSnapshot.structure,
        snapshotId: Number(generatedSnapshot.id),
        source: "remote",
        status: generatedSnapshot.status,
        generation_trace: generatedSnapshot.generation_trace,
        qualityReport: generatedSnapshot.qualityReport,
      };
      const validation = validateCourseEntry(entry, {
        centralSourceRecords: sourceRecordsData.sources,
        requireSources: true,
      });
      if (!validation.valid) {
        throw new Error(`Generated course failed validation: ${formatCourseValidationErrors(validation.errors)}`);
      }
      setCourses((prev) => [entry, ...prev]);
      setPrompt("");
      setGenerateStatus("success");
      setGenerateMessage("Course generated and ready for review.");
      void openCourseByEntry(entry);
    } catch (err) {
      console.warn("Course generation failed:", err);
      setGenerateStatus("error");
      setGenerateMessage(err instanceof Error ? err.message : "Course generation failed. Is the API running?");
    }
  };

  const handlePublishCourse = useCallback(
    async (course: CourseEntry) => {
      if (!course.snapshotId) return;
      setPublishingCourseKey(course.key);
      try {
        const publishedCourse = await lyciumApi.publishCourse(course.snapshotId);
        const entry: CourseEntry = {
          key: `remote-${publishedCourse.id}`,
          title: publishedCourse.title,
          data: publishedCourse.structure,
          snapshotId: Number(publishedCourse.id),
          source: "remote",
          status: publishedCourse.status,
          generation_trace: publishedCourse.generation_trace,
          qualityReport: publishedCourse.qualityReport,
        };
        const validation = validateCourseEntry(entry, {
          centralSourceRecords: sourceRecordsData.sources,
          requireSources: true,
        });
        if (!validation.valid) {
          throw new Error(`Published course failed validation: ${formatCourseValidationErrors(validation.errors)}`);
        }
        setCourses((prev) => prev.map((current) => (current.key === course.key ? entry : current)));
      } catch (err) {
        console.warn("Course publish failed:", err);
        setGenerateStatus("error");
        setGenerateMessage(err instanceof Error ? err.message : "Course publish failed.");
      } finally {
        setPublishingCourseKey(null);
      }
    },
    [setCourses],
  );

  return {
    generateStatus,
    generateMessage,
    publishingCourseKey,
    handleGenerateCourse,
    handlePublishCourse,
  };
}


"use client";

import { useCallback, useState } from "react";
import type { Dispatch, FormEvent, SetStateAction } from "react";
import sourceRecordsData from "../courseData/sourceRecords";
import type { CourseEntry } from "../courseTypes";
import type {
  LyciumCourseGenerationJob,
  LyciumGeneratedCourseRecord,
  LyciumGenerationInputFilePayload,
} from "@lycium/contracts";
import { lyciumApi } from "../runtime/appRuntime";
import { formatCourseValidationErrors, validateCourseEntry } from "../utils/courseValidation";
import {
  DEFAULT_SOURCE_COVERAGE_POLICY,
  createSourceGapDraftCourse,
  queueCourseSourceGapSuggestion,
  sourceCountMeetsMinimum,
  submittedSourceCount,
} from "../utils/courseSourceGaps";

type CourseClassification = {
  category: string;
  department: string;
};

export function fileToGenerationPayload(file: File): Promise<LyciumGenerationInputFilePayload> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const base64 = result.includes(",") ? result.split(",").pop() || "" : result;
      resolve({
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        base64,
      });
    };
    reader.readAsDataURL(file);
  });
}

type UseCourseGenerationActionsArgs = {
  prompt: string;
  level: string;
  learnerId: number | null;
  activeAiReady: boolean;
  aiLockedReason: string;
  setCourses: Dispatch<SetStateAction<CourseEntry[]>>;
  setPrompt: Dispatch<SetStateAction<string>>;
  openCourseByEntry: (course: CourseEntry, replace?: boolean) => void | Promise<void>;
};

export function useCourseGenerationActions({
  prompt,
  level,
  learnerId,
  activeAiReady,
  aiLockedReason,
  setCourses,
  setPrompt,
  openCourseByEntry,
}: UseCourseGenerationActionsArgs) {
  const [generateStatus, setGenerateStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [generateMessage, setGenerateMessage] = useState("");
  const [publishingCourseKey, setPublishingCourseKey] = useState<string | null>(null);

  const entryFromGeneratedRecord = useCallback((record: LyciumGeneratedCourseRecord): CourseEntry => ({
    key: `remote-${record.id}`,
    title: record.title,
    data: record.structure,
    snapshotId: Number(record.id),
    source: "remote",
    status: record.status,
    generation_trace: record.generation_trace,
    qualityReport: record.qualityReport,
  }), []);

  const replaceCourseFromJob = useCallback((course: CourseEntry, job: LyciumCourseGenerationJob) => {
    const snapshot = job.course_snapshot;
    if (!snapshot?.structure) {
      return course;
    }
    return entryFromGeneratedRecord({
      ...snapshot,
      generation_trace: snapshot.generation_trace ?? job.trace,
      qualityReport: snapshot.qualityReport ?? job.quality_report ?? undefined,
    });
  }, [entryFromGeneratedRecord]);

  const handleGenerateCourse = async (
    evt: FormEvent<HTMLFormElement>,
    sourceLinks: string[] = [],
    classification?: CourseClassification,
    sourceFiles: File[] = [],
  ) => {
    evt.preventDefault();
    if (!activeAiReady) {
      setGenerateStatus("error");
      setGenerateMessage(aiLockedReason || "Connect and verify an active AI model before generating a course.");
      return;
    }
    if (!prompt.trim() || !classification?.category || !classification.department) return;
    const sourceFileNames = sourceFiles.map((file) => file.name);
    if (!sourceCountMeetsMinimum(sourceLinks, sourceFileNames)) {
      const draft = createSourceGapDraftCourse({ prompt, level, sourceLinks, sourceFileNames, classification });
      setCourses((prev) => [draft, ...prev]);
      setPrompt("");
      setGenerateStatus("success");
      setGenerateMessage(
        `Course draft needs more sources: ${submittedSourceCount(sourceLinks, sourceFileNames)}/${DEFAULT_SOURCE_COVERAGE_POLICY.minimumCourseSources} minimum sources attached.`,
      );
      return;
    }
    setGenerateStatus("loading");
    setGenerateMessage("Starting course generation...");

    try {
      const inputArtifacts = sourceFiles.length
        ? (await lyciumApi.readGenerationInputFiles(await Promise.all(sourceFiles.map(fileToGenerationPayload)))).artifacts
        : [];
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
        input_artifacts: inputArtifacts,
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

      const entry = entryFromGeneratedRecord(generatedSnapshot);
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
    [entryFromGeneratedRecord, setCourses],
  );

  const handleResumeCourseSourceGap = useCallback(
    async (course: CourseEntry, gapId: string, url: string, description: string, sourceFiles: File[] = []) => {
      const queuedCourse = queueCourseSourceGapSuggestion(course, { gapId, url, description });
      setCourses((prev) => prev.map((current) => (current.key === course.key ? queuedCourse : current)));
      if (!course.snapshotId) {
        setGenerateStatus("success");
        setGenerateMessage("Source suggestion queued locally. API resume is available once the draft is backed by a local snapshot.");
        return;
      }

      setGenerateStatus("loading");
      setGenerateMessage("Adding source and checking whether generation can resume...");
      try {
        const inputArtifacts = sourceFiles.length
          ? (await lyciumApi.readGenerationInputFiles(await Promise.all(sourceFiles.map(fileToGenerationPayload)))).artifacts
          : [];
        const job = await lyciumApi.resumeCourseSourceGaps(course.snapshotId, {
          source_urls: url ? [url] : [],
          input_artifacts: inputArtifacts,
        });
        const updatedCourse = replaceCourseFromJob(queuedCourse, job);
        setCourses((prev) => prev.map((current) => (current.key === course.key ? updatedCourse : current)));
        if (job.status === "queued" || job.status === "running") {
          setGenerateStatus("success");
          setGenerateMessage("Source coverage is sufficient. Course generation has resumed.");
          return;
        }
        if (job.status === "failed") {
          throw new Error(job.error || job.message || "Source-gap resume failed.");
        }
        setGenerateStatus("success");
        setGenerateMessage(job.message || "Source added. More source coverage is still needed.");
      } catch (err) {
        console.warn("Course source-gap resume failed:", err);
        setGenerateStatus("error");
        setGenerateMessage(err instanceof Error ? err.message : "Source-gap resume failed. Is the API running?");
        throw err;
      }
    },
    [replaceCourseFromJob, setCourses],
  );

  return {
    generateStatus,
    generateMessage,
    publishingCourseKey,
    handleGenerateCourse,
    handlePublishCourse,
    handleResumeCourseSourceGap,
  };
}

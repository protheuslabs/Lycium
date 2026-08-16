"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { queueCourseSourceGapSuggestion } from "../utils/courseSourceGaps";
import {
  courseGenerationFailureMessage,
  courseGenerationSpecificStatusMessage,
  courseGenerationWorkingTitle,
  generatedCourseRecordFromJob,
  humanReadableCourseGenerationError,
  isActiveCourseGenerationJob,
  recoverableCourseGenerationJobId,
} from "../utils/courseGenerationJobs";

type CourseClassification = {
  category: string;
  department: string;
};

const ACTIVE_COURSE_GENERATION_JOB_STORAGE_KEY = "lycium.activeCourseGenerationJobId";
const COURSE_GENERATION_POLL_INTERVAL_MS = 2500;

type PollCourseGenerationOptions = {
  clearPromptOnComplete?: boolean;
  openOnComplete?: boolean;
};

function generationWorkflowMessage(job: LyciumCourseGenerationJob): string {
  const status = job.workflow_status;
  const message = status && typeof status === "object" && "message" in status ? status.message : null;
  return typeof message === "string" && message.trim()
    ? message
    : job.message || job.current_stage || "Generating course...";
}

function readActiveGenerationJobId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACTIVE_COURSE_GENERATION_JOB_STORAGE_KEY);
}

function writeActiveGenerationJobId(jobId: string | number): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACTIVE_COURSE_GENERATION_JOB_STORAGE_KEY, String(jobId));
}

function clearActiveGenerationJobId(jobId?: string | number): void {
  if (typeof window === "undefined") return;
  if (jobId === undefined || window.localStorage.getItem(ACTIVE_COURSE_GENERATION_JOB_STORAGE_KEY) === String(jobId)) {
    window.localStorage.removeItem(ACTIVE_COURSE_GENERATION_JOB_STORAGE_KEY);
  }
}

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
  const [generateProgress, setGenerateProgress] = useState(0);
  const [generateTitle, setGenerateTitle] = useState("New Course");
  const [publishingCourseKey, setPublishingCourseKey] = useState<string | null>(null);
  const [failedGenerationJobId, setFailedGenerationJobId] = useState<string | null>(null);
  const activePollJobIdRef = useRef<string | null>(null);
  const mountedRef = useRef(false);

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
    const record = generatedCourseRecordFromJob(job);
    return record ? entryFromGeneratedRecord(record) : course;
  }, [entryFromGeneratedRecord]);

  const syncGenerationStatusFromJob = useCallback((job: LyciumCourseGenerationJob) => {
    setGenerateProgress(job.progress ?? 0);
    setGenerateMessage(courseGenerationSpecificStatusMessage(job) || generationWorkflowMessage(job));
    setGenerateTitle(courseGenerationWorkingTitle(job) || "New Course");
  }, []);

  const finishCourseGenerationJob = useCallback((
    job: LyciumCourseGenerationJob,
    options: PollCourseGenerationOptions = {},
  ) => {
    if (job.status === "failed") {
      throw new Error(courseGenerationFailureMessage(job));
    }

    const generatedSnapshot = generatedCourseRecordFromJob(job);
    if (!generatedSnapshot) {
      throw new Error("Course generation finished without a ready course snapshot.");
    }

    const entry = entryFromGeneratedRecord(generatedSnapshot);
    const validation = validateCourseEntry(entry, {
      centralSourceRecords: sourceRecordsData.sources,
      requireSources: entry.status !== "needs_sources",
    });
    if (!validation.valid) {
      throw new Error(`Generated course failed validation: ${formatCourseValidationErrors(validation.errors)}`);
    }
    setCourses((prev) => {
      const existingIndex = prev.findIndex((current) => (
        current.key === entry.key ||
        (entry.snapshotId !== undefined && current.snapshotId === entry.snapshotId)
      ));
      if (existingIndex < 0) return [entry, ...prev];
      return prev.map((current, index) => (index === existingIndex ? entry : current));
    });
    if (options.clearPromptOnComplete !== false) {
      setPrompt("");
    }
    setGenerateStatus("success");
    setFailedGenerationJobId(null);
    setGenerateProgress(1);
    setGenerateTitle(entry.title);
    setGenerateMessage(
      entry.status === "needs_sources"
        ? "Course generated; sources need review."
        : entry.status === "needs_revision"
        ? "Course generated; review gates need attention."
        : "Course generated and ready for review."
    );
    if (options.openOnComplete !== false) {
      void openCourseByEntry(entry);
    }
  }, [entryFromGeneratedRecord, openCourseByEntry, setCourses, setPrompt]);

  const pollCourseGenerationJob = useCallback(async (
    initialJob: LyciumCourseGenerationJob,
    options: PollCourseGenerationOptions = {},
  ) => {
    const jobId = String(initialJob.id);
    activePollJobIdRef.current = jobId;
    writeActiveGenerationJobId(jobId);
    setGenerateStatus("loading");

    try {
      let job = initialJob;
      while (isActiveCourseGenerationJob(job)) {
        if (!mountedRef.current || activePollJobIdRef.current !== jobId) return;
        syncGenerationStatusFromJob(job);
        await new Promise((resolve) => window.setTimeout(resolve, COURSE_GENERATION_POLL_INTERVAL_MS));
        if (!mountedRef.current || activePollJobIdRef.current !== jobId) return;
        job = await lyciumApi.getCourseGenerationJob(jobId);
      }

      if (!mountedRef.current || activePollJobIdRef.current !== jobId) return;
      syncGenerationStatusFromJob(job);
      if (job.status === "failed") {
        setFailedGenerationJobId(jobId);
      } else {
        setFailedGenerationJobId(null);
      }
      finishCourseGenerationJob(job, options);
      clearActiveGenerationJobId(jobId);
      activePollJobIdRef.current = null;
    } catch (err) {
      if (!mountedRef.current || activePollJobIdRef.current !== jobId) return;
      console.warn("Course generation failed:", err);
      clearActiveGenerationJobId(jobId);
      activePollJobIdRef.current = null;
      setGenerateStatus("error");
      setGenerateProgress(0);
      setGenerateMessage(humanReadableCourseGenerationError(err instanceof Error ? err.message : err));
    }
  }, [finishCourseGenerationJob, syncGenerationStatusFromJob]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      activePollJobIdRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function recoverActiveGenerationJob() {
      if (activePollJobIdRef.current) return;
      let job: LyciumCourseGenerationJob | null = null;
      const storedJobId = readActiveGenerationJobId();

      if (storedJobId) {
        try {
          job = await lyciumApi.getCourseGenerationJob(storedJobId);
          if (!cancelled) {
            void pollCourseGenerationJob(job, { clearPromptOnComplete: false, openOnComplete: false });
          }
          return;
        } catch (err) {
          console.warn("Could not recover saved course generation job:", err);
          clearActiveGenerationJobId(storedJobId);
        }
      }

      const runs = await lyciumApi.listGenerationRuns({ status: "running", limit: 10 });
      const runningJobId = recoverableCourseGenerationJobId(runs);
      job = runningJobId ? await lyciumApi.getCourseGenerationJob(runningJobId) : null;

      if (cancelled || !job || !isActiveCourseGenerationJob(job)) {
        return;
      }

      void pollCourseGenerationJob(job, { clearPromptOnComplete: false, openOnComplete: false });
    }

    void recoverActiveGenerationJob().catch((err) => {
      console.warn("Could not recover active course generation:", err);
    });

    return () => {
      cancelled = true;
    };
  }, [pollCourseGenerationJob]);

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
    setGenerateStatus("loading");
    setFailedGenerationJobId(null);
    setGenerateProgress(0);
    setGenerateTitle("New Course");
    setGenerateMessage("Creating course template...");

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
      await pollCourseGenerationJob(job, { clearPromptOnComplete: true, openOnComplete: true });
    } catch (err) {
      console.warn("Course generation failed:", err);
      setGenerateStatus("error");
      setGenerateProgress(0);
      setGenerateMessage(humanReadableCourseGenerationError(err instanceof Error ? err.message : err));
    }
  };

  const handleRetryGenerateCourse = useCallback(async () => {
    if (!failedGenerationJobId) {
      setGenerateStatus("error");
      setGenerateMessage("There is no saved generation request to retry.");
      return;
    }
    if (!activeAiReady) {
      setGenerateStatus("error");
      setGenerateMessage(aiLockedReason || "Connect and verify an active AI model before retrying course generation.");
      return;
    }

    setGenerateStatus("loading");
    setGenerateProgress(0);
    setGenerateMessage("Retrying from the saved request...");

    try {
      const job = await lyciumApi.resumeCourseGenerationJob(failedGenerationJobId);
      await pollCourseGenerationJob(job, { clearPromptOnComplete: true, openOnComplete: true });
    } catch (err) {
      console.warn("Course generation retry failed:", err);
      setGenerateStatus("error");
      setGenerateProgress(0);
      setGenerateMessage(humanReadableCourseGenerationError(err instanceof Error ? err.message : err));
    }
  }, [activeAiReady, aiLockedReason, failedGenerationJobId, pollCourseGenerationJob]);

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
    generateProgress,
    generateTitle,
    publishingCourseKey,
    handleGenerateCourse,
    handleRetryGenerateCourse,
    handlePublishCourse,
    handleResumeCourseSourceGap,
  };
}

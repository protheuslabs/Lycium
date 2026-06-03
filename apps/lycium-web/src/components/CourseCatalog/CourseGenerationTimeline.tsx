import { useEffect, useMemo, useState } from "react";
import type { LyciumGenerationRun, LyciumGenerationRunEvent } from "@lycium/data-access";
import type { CourseEntry } from "../../courseTypes";
import { lyciumApi } from "../../runtime/appRuntime";

type LoadState = "idle" | "loading" | "error" | "success";

type CourseGenerationTimelineProps = {
  course: CourseEntry;
};

const MAX_RUNS_TO_SCAN = 30;
const MAX_EVENTS = 8;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

function formatDate(value?: string | null): string {
  if (!value) return "Unknown time";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatProgress(value?: number | null): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Not started";
  const normalized = value <= 1 ? value * 100 : value;
  return `${Math.max(0, Math.min(100, Math.round(normalized)))}%`;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function sourceCorpusSummary(record: Record<string, unknown> | null): string {
  if (!record) return "No source decision summary recorded.";
  const included = numberValue(record.includedSourceCount ?? record.included ?? record.included_count);
  const excluded = numberValue(record.excludedSourceCount ?? record.excluded ?? record.excluded_count);
  const submitted = numberValue(record.submittedSourceCount ?? record.submitted ?? record.submitted_count);
  if (included === null && excluded === null && submitted === null) return "Source decisions recorded.";
  return `${included ?? 0} accepted${excluded !== null ? `, ${excluded} excluded` : ""}${submitted !== null ? ` from ${submitted} submitted` : ""}.`;
}

function qualitySummary(record: Record<string, unknown> | null): string {
  if (!record) return "No quality report recorded.";
  const score = numberValue(record.score ?? record.qualityScore ?? record.quality_score);
  const passed = record.passed ?? record.qualityPassed ?? record.quality_passed;
  const errors = numberValue(record.errorCount ?? record.error_count);
  const warnings = numberValue(record.warningCount ?? record.warning_count);
  const outcome = typeof passed === "boolean" ? (passed ? "passed" : "blocked") : stringValue(record.status) ?? "recorded";
  return `${outcome}${score !== null ? ` · ${Math.round(score * (score <= 1 ? 100 : 1))}%` : ""}${errors !== null ? ` · ${errors} errors` : ""}${warnings !== null ? ` · ${warnings} warnings` : ""}`;
}

function runMatchesCourse(run: LyciumGenerationRun, course: CourseEntry): boolean {
  if (!course.snapshotId) return false;
  if (run.course_snapshot_id === course.snapshotId) return true;
  const summarySnapshot = isRecord(run.result_summary.course_snapshot) ? run.result_summary.course_snapshot : {};
  const summaryId = numberValue(summarySnapshot.id);
  const traceId = numberValue(run.trace.course_snapshot_id);
  return summaryId === course.snapshotId || traceId === course.snapshotId;
}

function traceQualityReport(course: CourseEntry): Record<string, unknown> | null {
  const trace = isRecord(course.generation_trace) ? course.generation_trace : {};
  return isRecord(trace.quality_report) ? trace.quality_report : null;
}

function traceSourceGate(course: CourseEntry): Record<string, unknown> | null {
  const trace = isRecord(course.generation_trace) ? course.generation_trace : {};
  return isRecord(trace.source_coverage_gate) ? trace.source_coverage_gate : null;
}

function latestEvents(run: LyciumGenerationRun | null): LyciumGenerationRunEvent[] {
  return [...(run?.events ?? [])]
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
    .slice(0, MAX_EVENTS);
}

export default function CourseGenerationTimeline({ course }: CourseGenerationTimelineProps) {
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [message, setMessage] = useState("");
  const [run, setRun] = useState<LyciumGenerationRun | null>(null);
  const [resuming, setResuming] = useState(false);

  const fallbackQuality = useMemo(() => traceQualityReport(course), [course]);
  const fallbackSourceGate = useMemo(() => traceSourceGate(course), [course]);
  const events = useMemo(() => latestEvents(run), [run]);
  const canResume = Boolean(run?.job_id && run.status === "failed");
  const quality = isRecord(run?.result_summary.quality_report)
    ? run.result_summary.quality_report
    : isRecord(run?.trace.quality_report)
      ? run.trace.quality_report
      : fallbackQuality;
  const sourceCorpus = isRecord(run?.result_summary.source_corpus)
    ? run.result_summary.source_corpus
    : isRecord(run?.trace.source_corpus)
      ? run.trace.source_corpus
      : fallbackSourceGate;

  useEffect(() => {
    if (!course.snapshotId) return;
    let active = true;
    setLoadState("loading");
    setMessage("");
    lyciumApi
      .listGenerationRuns({ limit: MAX_RUNS_TO_SCAN })
      .then((runs) => {
        if (!active) return;
        setRun(runs.find((candidate) => runMatchesCourse(candidate, course)) ?? null);
        setLoadState("success");
      })
      .catch((error) => {
        if (!active) return;
        setLoadState("error");
        setMessage(error instanceof Error ? error.message : "Generation run history unavailable.");
      });
    return () => {
      active = false;
    };
  }, [course]);

  const handleResume = async () => {
    if (!run) return;
    setResuming(true);
    setMessage("");
    try {
      await lyciumApi.resumeGenerationRun(run.id);
      setMessage("Generation resumed. Refresh run history from settings to follow new events.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to resume generation.");
    } finally {
      setResuming(false);
    }
  };

  return (
    <section className="course-generation-timeline" aria-labelledby="course-generation-timeline-title">
      <div className="course-review-header">
        <h4 id="course-generation-timeline-title">Generation timeline</h4>
        <span className={`course-review-status course-review-status-${run?.status === "completed" ? "pass" : "wait"}`}>
          {run?.status ?? (loadState === "loading" ? "Loading" : "Trace only")}
        </span>
      </div>

      <div className="course-review-summary-grid course-generation-run-grid">
        <article>
          <span>Progress</span>
          <strong>{formatProgress(run?.progress)}</strong>
        </article>
        <article>
          <span>Stage</span>
          <strong>{run?.current_stage ?? "Attached trace"}</strong>
        </article>
        <article>
          <span>Model</span>
          <strong>{run?.model ?? run?.provider_id ?? "Not recorded"}</strong>
        </article>
        <article>
          <span>Updated</span>
          <strong>{formatDate(run?.updated_at)}</strong>
        </article>
      </div>

      <div className="course-generation-evidence-grid">
        <article>
          <span>Source decisions</span>
          <strong>{sourceCorpusSummary(sourceCorpus)}</strong>
        </article>
        <article>
          <span>Quality result</span>
          <strong>{qualitySummary(quality)}</strong>
        </article>
      </div>

      {events.length > 0 ? (
        <div className="course-generation-event-list">
          {events.map((event) => (
            <article className="course-generation-event" key={event.id}>
              <div>
                <strong>{event.stage || event.event_type.replaceAll("_", " ")}</strong>
                <span>{formatDate(event.created_at)}</span>
              </div>
              <p>{event.message || event.status || event.event_type.replaceAll("_", " ")}</p>
            </article>
          ))}
        </div>
      ) : (
        <p className="course-info-muted">
          {loadState === "error" ? message : "No local run events are attached yet."}
        </p>
      )}

      {canResume && (
        <button className="course-review-publish-button course-generation-resume-button" type="button" disabled={resuming} onClick={() => void handleResume()}>
          {resuming ? "Resuming" : "Resume generation"}
        </button>
      )}
      {message && events.length > 0 && <p className="course-info-muted">{message}</p>}
    </section>
  );
}

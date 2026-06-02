import { useEffect, useMemo, useState } from "react";
import type { LyciumGenerationRun } from "@lycium/data-access";
import { lyciumApi } from "../../runtime/appRuntime";

type LoadState = "idle" | "loading" | "error" | "success";

const MAX_VISIBLE_RUNS = 6;

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

function formatProgress(value: number): string {
  const normalized = value <= 1 ? value * 100 : value;
  return `${Math.max(0, Math.min(100, Math.round(normalized)))}%`;
}

function readNumber(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function readString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

function summarizeRun(run: LyciumGenerationRun): string {
  const sourceSummary = run.result_summary?.source_corpus;
  if (sourceSummary && typeof sourceSummary === "object" && !Array.isArray(sourceSummary)) {
    const included = readNumber(sourceSummary as Record<string, unknown>, ["included", "included_count", "includedSourceCount"]);
    const excluded = readNumber(sourceSummary as Record<string, unknown>, ["excluded", "excluded_count", "excludedSourceCount"]);
    if (included !== null || excluded !== null) {
      return `Sources: ${included ?? 0} accepted${excluded !== null ? `, ${excluded} excluded` : ""}`;
    }
  }

  const qualityStatus = readString(run.result_summary, ["quality_status", "qualityStatus", "review_status"]);
  const qualityScore = readNumber(run.result_summary, ["quality_score", "qualityScore", "score"]);
  if (qualityStatus || qualityScore !== null) {
    return `Quality: ${qualityStatus ?? "scored"}${qualityScore !== null ? ` (${Math.round(qualityScore)}%)` : ""}`;
  }

  return run.message || run.current_stage || "No summary recorded yet";
}

export default function GenerationRunsPanel() {
  const [runs, setRuns] = useState<LyciumGenerationRun[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [message, setMessage] = useState("");
  const [resumingRunId, setResumingRunId] = useState<number | null>(null);

  const visibleRuns = useMemo(() => runs.slice(0, MAX_VISIBLE_RUNS), [runs]);

  const loadRuns = async () => {
    setLoadState("loading");
    setMessage("");
    try {
      const nextRuns = await lyciumApi.listGenerationRuns({ limit: MAX_VISIBLE_RUNS });
      setRuns(nextRuns);
      setLoadState("success");
    } catch (error) {
      setLoadState("error");
      setMessage(error instanceof Error ? error.message : "Generation run history unavailable.");
    }
  };

  useEffect(() => {
    void loadRuns();
  }, []);

  const handleResume = async (run: LyciumGenerationRun) => {
    setResumingRunId(run.id);
    setMessage("");
    try {
      await lyciumApi.resumeGenerationRun(run.id);
      setMessage("Generation resumed. The run history will update as the backend records progress.");
      await loadRuns();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to resume generation.");
    } finally {
      setResumingRunId(null);
    }
  };

  return (
    <section className="settings-section" aria-labelledby="settings-generation-runs">
      <div className="settings-section-heading-row">
        <h2 id="settings-generation-runs">Generation Runs</h2>
        <button
          className="settings-run-refresh-button"
          type="button"
          disabled={loadState === "loading"}
          onClick={() => void loadRuns()}
        >
          Refresh
        </button>
      </div>
      <div className="settings-run-panel">
        {loadState === "loading" && !visibleRuns.length && (
          <p className="settings-run-empty">Loading recent runs...</p>
        )}
        {loadState === "error" && !visibleRuns.length && (
          <p className="settings-run-empty">{message || "Generation run history unavailable."}</p>
        )}
        {loadState === "success" && !visibleRuns.length && (
          <p className="settings-run-empty">No generation runs recorded yet.</p>
        )}
        {visibleRuns.map((run) => {
          const canResume = run.status === "failed" && Boolean(run.job_id);
          const isResuming = resumingRunId === run.id;
          return (
            <article className="settings-run-row" key={run.id}>
              <div className="settings-run-main">
                <span className={`settings-run-status settings-run-status-${run.status}`}>{run.status}</span>
                <strong>{run.prompt || "Untitled generation run"}</strong>
                <span>{summarizeRun(run)}</span>
              </div>
              <div className="settings-run-meta">
                <span>{formatProgress(run.progress)}</span>
                <span>{run.current_stage || run.run_type}</span>
                <span>{run.model || run.provider_id || "No model"}</span>
                <span>{formatDate(run.updated_at || run.created_at)}</span>
              </div>
              {canResume && (
                <button
                  className="settings-run-resume-button"
                  type="button"
                  disabled={isResuming}
                  onClick={() => void handleResume(run)}
                >
                  {isResuming ? "Resuming" : "Resume"}
                </button>
              )}
            </article>
          );
        })}
      </div>
      {message && visibleRuns.length > 0 && <p className="settings-run-message">{message}</p>}
    </section>
  );
}

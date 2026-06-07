import { useEffect, useMemo, useState } from "react";
import type { LyciumGenerationEvalTrend, LyciumGenerationRun } from "@lycium/data-access";
import { lyciumApi } from "../../runtime/appRuntime";

type LoadState = "idle" | "loading" | "error" | "success";
type EvalStatus = "passed" | "needs_review" | "failed" | "unknown";

type EvalDashboardRow = {
  id: number;
  title: string;
  detail: string;
  kind: string;
  status: EvalStatus;
  score: number | null;
  sourceCoverage: number | null;
  quizQuality: number | null;
  contentDepth: number | null;
  citationValidity: number | null;
  updatedAt?: string | null;
};

const MAX_EVAL_RUNS = 12;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(record: Record<string, unknown> | null | undefined, keys: string[]): string | null {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function readNumber(record: Record<string, unknown> | null | undefined, keys: string[]): number | null {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function readRecord(record: Record<string, unknown>, keys: string[]): Record<string, unknown> | null {
  for (const key of keys) {
    const value = record[key];
    if (isRecord(value)) return value;
  }
  return null;
}

function readNestedRecord(record: Record<string, unknown>, paths: string[][]): Record<string, unknown> | null {
  for (const path of paths) {
    let cursor: unknown = record;
    for (const key of path) {
      if (!isRecord(cursor)) {
        cursor = null;
        break;
      }
      cursor = cursor[key];
    }
    if (isRecord(cursor)) return cursor;
  }
  return null;
}

function normalizePercent(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  const percent = value <= 1 ? value * 100 : value;
  return Math.max(0, Math.min(100, percent));
}

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

function formatPercent(value: number | null): string {
  if (value === null) return "No score";
  return `${Math.round(value)}%`;
}

function formatScore(value?: number | null): string {
  return formatPercent(normalizePercent(typeof value === "number" ? value : null));
}

function formatDelta(value?: number | null): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "New";
  const percentagePoints = Math.round((Math.abs(value) <= 1 ? value * 100 : value) * 10) / 10;
  if (percentagePoints === 0) return "No change";
  return `${percentagePoints > 0 ? "+" : ""}${percentagePoints} pts`;
}

function normalizeStatus(value: unknown): EvalStatus {
  if (typeof value !== "string") return "unknown";
  const normalized = value.toLowerCase().replaceAll("-", "_").replaceAll(" ", "_");
  if (normalized.includes("pass") || normalized.includes("ready") || normalized.includes("published")) {
    return "passed";
  }
  if (normalized.includes("fail") || normalized.includes("error") || normalized.includes("blocked")) {
    return "failed";
  }
  if (normalized.includes("review") || normalized.includes("warn") || normalized.includes("draft") || normalized.includes("needs")) {
    return "needs_review";
  }
  return "unknown";
}

function average(values: Array<number | null>): number | null {
  const validValues = values.filter((value): value is number => value !== null && Number.isFinite(value));
  if (!validValues.length) return null;
  return validValues.reduce((total, value) => total + value, 0) / validValues.length;
}

function reportFromRun(run: LyciumGenerationRun, names: string[]): Record<string, unknown> | null {
  const summaryReport = readNestedRecord(run.result_summary, names.map((name) => [name]));
  if (summaryReport) return summaryReport;
  return readNestedRecord(run.trace, names.map((name) => [name]));
}

function nestedQualityReport(run: LyciumGenerationRun): Record<string, unknown> | null {
  return (
    reportFromRun(run, ["quality_report", "qualityReport", "course_quality_report", "courseQualityReport"]) ??
    readNestedRecord(run.result_summary, [["generation_trace", "quality_report"], ["generationTrace", "qualityReport"]]) ??
    readNestedRecord(run.trace, [["generation_trace", "quality_report"], ["generationTrace", "qualityReport"]])
  );
}

function nestedScenarioReport(run: LyciumGenerationRun): Record<string, unknown> | null {
  return reportFromRun(run, ["scenario_report", "scenarioReport", "eval_report", "evalReport"]);
}

function pushRecordArray(value: unknown, records: Record<string, unknown>[]) {
  if (!Array.isArray(value)) return;
  for (const item of value) {
    if (isRecord(item)) records.push(item);
  }
}

function collectSignalRecords(report: Record<string, unknown> | null): Record<string, unknown>[] {
  if (!report) return [];
  const records: Record<string, unknown>[] = [];
  const evals = readRecord(report, ["evals", "quality_evals", "qualityEvals"]);
  const workflow = readRecord(report, ["workflow", "qualityWorkflow"]);

  pushRecordArray(report.dimensions, records);
  pushRecordArray(report.checks, records);
  pushRecordArray(report.gates, records);
  pushRecordArray(evals?.dimensions, records);
  pushRecordArray(evals?.checks, records);
  pushRecordArray(workflow?.gates, records);

  return records;
}

function recordSignalText(record: Record<string, unknown>): string {
  return [readString(record, ["key", "id", "name", "label", "dimension", "gate"]), readString(record, ["title", "description"])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function scoreFromSignals(reports: Array<Record<string, unknown> | null>, terms: string[]): number | null {
  const scores: number[] = [];
  for (const report of reports) {
    for (const record of collectSignalRecords(report)) {
      const text = recordSignalText(record);
      if (!terms.some((term) => text.includes(term))) continue;
      const score = normalizePercent(readNumber(record, ["score", "value", "ratio", "coverage", "passRate"]));
      if (score !== null) scores.push(score);
    }
  }
  return average(scores);
}

function scoreFromMetrics(reports: Array<Record<string, unknown> | null>, keys: string[]): number | null {
  for (const report of reports) {
    const metrics = report ? readRecord(report, ["metrics", "summary", "metricSummary"]) : null;
    const score = normalizePercent(readNumber(metrics, keys) ?? readNumber(report, keys));
    if (score !== null) return score;
  }
  return null;
}

function scoreFor(
  reports: Array<Record<string, unknown> | null>,
  terms: string[],
  metricKeys: string[],
): number | null {
  return scoreFromSignals(reports, terms) ?? scoreFromMetrics(reports, metricKeys);
}

function rowStatus(run: LyciumGenerationRun, reports: Array<Record<string, unknown> | null>): EvalStatus {
  for (const report of reports) {
    const status = normalizeStatus(readString(report, ["status", "qualityStatus", "reviewStatus", "publishStatus"]));
    if (status !== "unknown") return status;
  }
  if (run.status === "failed") return "failed";
  if (run.status === "running") return "needs_review";
  return "unknown";
}

function rowFromRun(run: LyciumGenerationRun): EvalDashboardRow {
  const qualityReport = nestedQualityReport(run);
  const scenarioReport = nestedScenarioReport(run);
  const reports = [scenarioReport, qualityReport];
  const evals = readRecord(qualityReport ?? {}, ["evals", "quality_evals", "qualityEvals"]);
  const score = normalizePercent(
    readNumber(scenarioReport, ["score", "overallScore", "overall_score"]) ??
      readNumber(evals, ["overallScore", "overall_score", "score"]) ??
      readNumber(qualityReport, ["score", "qualityScore", "quality_score", "overallScore", "overall_score"]),
  );
  const title =
    readString(scenarioReport, ["scenarioLabel", "scenario_label", "label", "title"]) ??
    readString(qualityReport, ["courseTitle", "course_title", "title"]) ??
    run.prompt ??
    "Untitled generation run";
  const detail =
    readString(scenarioReport, ["scenarioId", "scenario_id", "kind"]) ??
    readString(qualityReport, ["status", "reviewStatus", "review_status"]) ??
    (qualityReport || scenarioReport ? "Eval evidence recorded" : "No eval report recorded");

  return {
    id: run.id,
    title,
    detail,
    kind: readString(scenarioReport, ["kind", "scenarioKind", "scenario_kind"]) ?? run.run_type,
    status: rowStatus(run, reports),
    score,
    sourceCoverage: scoreFor(reports, ["source", "grounding", "coverage"], [
      "sourceCoverage",
      "source_coverage",
      "sourcedSectionRatio",
      "sourced_section_ratio",
      "requirementSourceCoverage",
      "requirement_source_coverage",
    ]),
    quizQuality: scoreFor(reports, ["assessment", "quiz", "question"], [
      "quizQuality",
      "quiz_quality",
      "validQuestionRatio",
      "valid_question_ratio",
      "assessmentCoverage",
      "assessment_coverage",
    ]),
    contentDepth: scoreFor(reports, ["instructional", "substance", "concept", "vertical", "specificity"], [
      "contentDepth",
      "content_depth",
      "substanceScore",
      "substance_score",
      "conceptCoverage",
      "concept_coverage",
    ]),
    citationValidity: scoreFor(reports, ["citation", "reference", "local source"], [
      "citationValidity",
      "citation_validity",
      "validCitationRatio",
      "valid_citation_ratio",
    ]),
    updatedAt: run.updated_at || run.created_at,
  };
}

function statusLabel(status: EvalStatus): string {
  if (status === "passed") return "Passed";
  if (status === "needs_review") return "Review";
  if (status === "failed") return "Failed";
  return "Unknown";
}

function EvalMetric({ label, value }: { label: string; value: number | null }) {
  return (
    <span className={`settings-eval-metric${value === null ? " settings-eval-metric-empty" : ""}`}>
      <span>{label}</span>
      <strong>{formatPercent(value)}</strong>
    </span>
  );
}

function TrendRow({ row }: { row: LyciumGenerationEvalTrend["scenarioTrends"][number] }) {
  const status = normalizeStatus(row.status);
  return (
    <article className="settings-eval-trend-row">
      <div className="settings-eval-main">
        <span className={`settings-eval-status settings-eval-status-${status}`}>
          {statusLabel(status)}
        </span>
        <strong>{row.scenarioLabel || row.scenarioId}</strong>
        <span>{row.scenarioId}</span>
      </div>
      <div className="settings-eval-score">
        <span>{formatDelta(row.scoreDelta)}</span>
        <strong>{formatScore(row.score)}</strong>
        <span>{row.previousScore === null || row.previousScore === undefined ? "No prior run" : `Previous ${formatScore(row.previousScore)}`}</span>
      </div>
    </article>
  );
}

export default function EvalScoreDashboard() {
  const [runs, setRuns] = useState<LyciumGenerationRun[]>([]);
  const [evalTrend, setEvalTrend] = useState<LyciumGenerationEvalTrend | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [message, setMessage] = useState("");

  const rows = useMemo(() => runs.map(rowFromRun), [runs]);
  const scoredRows = useMemo(() => rows.filter((row) => row.score !== null), [rows]);
  const averageScore = useMemo(() => average(scoredRows.map((row) => row.score)), [scoredRows]);
  const passCount = rows.filter((row) => row.status === "passed").length;
  const reviewCount = rows.filter((row) => row.status === "needs_review" || row.status === "unknown").length;
  const failCount = rows.filter((row) => row.status === "failed").length;

  const loadRuns = async () => {
    setLoadState("loading");
    setMessage("");
    const [runResult, trendResult] = await Promise.allSettled([
      lyciumApi.listGenerationRuns({ limit: MAX_EVAL_RUNS }),
      lyciumApi.loadGenerationEvalTrend({ limit: MAX_EVAL_RUNS }),
    ]);
    if (runResult.status === "fulfilled") {
      setRuns(runResult.value);
    }
    if (trendResult.status === "fulfilled") {
      setEvalTrend(trendResult.value.trend);
    }
    if (runResult.status === "fulfilled" || trendResult.status === "fulfilled") {
      setLoadState("success");
      if (runResult.status === "rejected" || trendResult.status === "rejected") {
        const error = runResult.status === "rejected" ? runResult.reason : trendResult.status === "rejected" ? trendResult.reason : null;
        setMessage(error instanceof Error ? error.message : "Some eval data is unavailable.");
      }
      return;
    }
    setLoadState("error");
    const error = runResult.status === "rejected" ? runResult.reason : trendResult.status === "rejected" ? trendResult.reason : null;
    setMessage(error instanceof Error ? error.message : "Eval dashboard unavailable.");
  };

  useEffect(() => {
    void loadRuns();
  }, []);

  return (
    <section className="settings-section" aria-labelledby="settings-eval-dashboard">
      <div className="settings-section-heading-row">
        <h2 id="settings-eval-dashboard">Eval Score Dashboard</h2>
        <button
          className="settings-run-refresh-button"
          type="button"
          disabled={loadState === "loading"}
          onClick={() => void loadRuns()}
        >
          Refresh
        </button>
      </div>
      <div className="settings-eval-panel">
        {evalTrend && evalTrend.runCount > 0 && (
          <div className="settings-eval-trend-panel" aria-label="Persisted generation eval trend">
            <div className="settings-eval-trend-heading">
              <div>
                <span>Persisted scenario evals</span>
                <strong>{evalTrend.latestRunId || "Latest run"}</strong>
              </div>
              <div>
                <span>{evalTrend.runCount} run{evalTrend.runCount === 1 ? "" : "s"}</span>
                <strong>{formatScore(evalTrend.latestSummary.averageScore)}</strong>
              </div>
            </div>
            <div className="settings-eval-trend-list">
              {evalTrend.scenarioTrends.map((row) => (
                <TrendRow key={row.scenarioId} row={row} />
              ))}
            </div>
          </div>
        )}
        <div className="settings-eval-summary-grid" aria-label="Generation eval summary">
          <span className="settings-eval-summary-card">
            <span>Runs</span>
            <strong>{rows.length}</strong>
          </span>
          <span className="settings-eval-summary-card">
            <span>Average</span>
            <strong>{formatPercent(averageScore)}</strong>
          </span>
          <span className="settings-eval-summary-card settings-eval-summary-pass">
            <span>Passed</span>
            <strong>{passCount}</strong>
          </span>
          <span className="settings-eval-summary-card settings-eval-summary-review">
            <span>Review</span>
            <strong>{reviewCount}</strong>
          </span>
          <span className="settings-eval-summary-card settings-eval-summary-fail">
            <span>Failed</span>
            <strong>{failCount}</strong>
          </span>
        </div>
        {loadState === "loading" && !rows.length && (
          <p className="settings-eval-empty">Loading eval records...</p>
        )}
        {loadState === "error" && !rows.length && (
          <p className="settings-eval-empty">{message || "Eval dashboard unavailable."}</p>
        )}
        {loadState === "success" && !rows.length && (
          <p className="settings-eval-empty">
            No eval records yet. Generate or review a course to populate this dashboard.
          </p>
        )}
        {rows.map((row) => (
          <article className="settings-eval-row" key={row.id}>
            <div className="settings-eval-main">
              <span className={`settings-eval-status settings-eval-status-${row.status}`}>
                {statusLabel(row.status)}
              </span>
              <strong>{row.title}</strong>
              <span>{row.detail}</span>
            </div>
            <div className="settings-eval-score">
              <span>{row.kind}</span>
              <strong>{formatPercent(row.score)}</strong>
              <span>{formatDate(row.updatedAt)}</span>
            </div>
            <div className="settings-eval-metrics" aria-label={`Eval signals for ${row.title}`}>
              <EvalMetric label="Sources" value={row.sourceCoverage} />
              <EvalMetric label="Quiz" value={row.quizQuality} />
              <EvalMetric label="Depth" value={row.contentDepth} />
              <EvalMetric label="Citations" value={row.citationValidity} />
            </div>
          </article>
        ))}
      </div>
      {message && rows.length > 0 && <p className="settings-eval-message">{message}</p>}
    </section>
  );
}

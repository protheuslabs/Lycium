import type {
  LyciumCourseGenerationGateResult,
  LyciumCourseQualityReport,
} from "@lycium/contracts";
import type { CourseEntry } from "../../courseTypes";
import CourseGenerationTimeline from "./CourseGenerationTimeline";

type CourseReviewPanelProps = {
  course: CourseEntry;
  isPublishing: boolean;
  onPublishCourse: (course: CourseEntry) => void;
};

type RequirementOriginRow = {
  title?: unknown;
  importance?: unknown;
  originType?: unknown;
  frequency?: unknown;
  evidenceRefs?: unknown;
};

type SourceSlotRow = {
  requiredConceptId?: unknown;
  primarySourceId?: unknown;
  fallbackSourceIds?: unknown;
  replacementPolicy?: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const asRecordArray = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.filter(isRecord) : [];

const textValue = (value: unknown, fallback = "Not recorded") =>
  typeof value === "string" && value.trim() ? value : fallback;

const numberValue = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);

function reviewMetadata(course: CourseEntry) {
  const metadata = isRecord(course.data.metadata) ? course.data.metadata : {};
  const trace = isRecord(course.generation_trace) ? course.generation_trace : {};
  const traceContext = isRecord(trace.curriculum_benchmark_context) ? trace.curriculum_benchmark_context : {};
  const qualityReport = (
    isRecord(course.qualityReport)
      ? course.qualityReport
      : isRecord(trace.quality_report)
        ? trace.quality_report
        : null
  ) as LyciumCourseQualityReport | null;

  const workflow = qualityReport?.workflow;
  const gates = Array.isArray(workflow?.gates) ? workflow.gates : [];
  const benchmarks = asRecordArray(metadata.curriculumBenchmarks ?? traceContext.curriculumBenchmarks);
  const requirementOrigins = asRecordArray(metadata.requirementOrigins ?? traceContext.requirementOrigins);
  const parityProfile = isRecord(metadata.courseParityProfile)
    ? metadata.courseParityProfile
    : isRecord(traceContext.courseParityProfile)
      ? traceContext.courseParityProfile
      : {};
  const sourceSlots = asRecordArray(metadata.sourceSlots ?? traceContext.sourceSlots);
  const failedGateCount = gates.filter((gate) => gate.status === "failed").length;
  const needsReviewGateCount = gates.filter((gate) => gate.status === "needs_review").length;
  const canPublish = course.status === "ready_for_review" && Boolean(qualityReport?.passed) && failedGateCount === 0;

  return { qualityReport, gates, benchmarks, requirementOrigins, parityProfile, sourceSlots, failedGateCount, needsReviewGateCount, canPublish };
}

function GateList({ gates }: { gates: LyciumCourseGenerationGateResult[] }) {
  if (gates.length === 0) {
    return <p className="course-info-muted">No workflow gate report is attached yet.</p>;
  }

  return (
    <div className="course-review-gate-list">
      {gates.map((gate) => (
        <article className={`course-review-gate course-review-gate-${gate.status}`} key={gate.gate}>
          <div>
            <strong>{gate.gate.replaceAll("_", " ")}</strong>
            <span>{gate.status.replaceAll("_", " ")}</span>
          </div>
          <p>{gate.summary}</p>
        </article>
      ))}
    </div>
  );
}

export default function CourseReviewPanel({ course, isPublishing, onPublishCourse }: CourseReviewPanelProps) {
  const { qualityReport, gates, benchmarks, requirementOrigins, parityProfile, sourceSlots, failedGateCount, needsReviewGateCount, canPublish } =
    reviewMetadata(course);
  const score = numberValue(qualityReport?.score);
  const coveragePercent = numberValue(parityProfile.coveragePercent);
  const requiredTopics = Array.isArray(parityProfile.commonRequiredTopics) ? parityProfile.commonRequiredTopics : [];

  return (
    <section className="course-info-section course-review-panel">
      <div className="course-review-header">
        <h3>Generation review</h3>
        <span className={`course-review-status ${canPublish ? "course-review-status-pass" : "course-review-status-wait"}`}>
          {canPublish ? "Publish ready" : "Review required"}
        </span>
      </div>
      <div className="course-review-summary-grid">
        <article>
          <span>Quality score</span>
          <strong>{score === null ? "Not scored" : `${Math.round(score * 100)}%`}</strong>
        </article>
        <article>
          <span>Gate issues</span>
          <strong>{failedGateCount} failed · {needsReviewGateCount} review</strong>
        </article>
        <article>
          <span>Benchmark records</span>
          <strong>{benchmarks.length}</strong>
        </article>
        <article>
          <span>Parity coverage</span>
          <strong>{coveragePercent === null ? "Not recorded" : `${coveragePercent}%`}</strong>
        </article>
      </div>

      <div className="course-review-section">
        <h4>Workflow gates</h4>
        <GateList gates={gates} />
      </div>

      <CourseGenerationTimeline course={course} />

      <div className="course-review-section">
        <h4>Required topics</h4>
        {requiredTopics.length > 0 ? (
          <div className="course-info-chip-row">
            {requiredTopics.slice(0, 12).map((topic) => (
              <span className="course-info-chip" key={String(topic)}>{String(topic)}</span>
            ))}
          </div>
        ) : (
          <p className="course-info-muted">No common required topics were recorded.</p>
        )}
      </div>

      <div className="course-review-section">
        <h4>Requirement origins</h4>
        {requirementOrigins.length > 0 ? (
          <div className="course-review-list">
            {(requirementOrigins as RequirementOriginRow[]).slice(0, 8).map((origin, index) => (
              <article className="course-review-row" key={`${textValue(origin.title, "Requirement")}-${index}`}>
                <strong>{textValue(origin.title, "Requirement")}</strong>
                <span>
                  {textValue(origin.importance, "unclassified")} · {textValue(origin.originType, "unknown origin")}
                </span>
              </article>
            ))}
          </div>
        ) : (
          <p className="course-info-muted">No requirement-origin evidence was recorded.</p>
        )}
      </div>

      <div className="course-review-section">
        <h4>Source slots</h4>
        {sourceSlots.length > 0 ? (
          <div className="course-review-list">
            {(sourceSlots as SourceSlotRow[]).slice(0, 8).map((slot, index) => (
              <article className="course-review-row" key={`${textValue(slot.requiredConceptId, "concept")}-${index}`}>
                <strong>{textValue(slot.requiredConceptId, "Required concept")}</strong>
                <span>
                  Primary: {textValue(slot.primarySourceId, "not set")} · {textValue(slot.replacementPolicy, "review policy")}
                </span>
              </article>
            ))}
          </div>
        ) : (
          <p className="course-info-muted">No source fallback slots were recorded.</p>
        )}
      </div>

      {course.status === "ready_for_review" && (
        <button className="course-review-publish-button" type="button" disabled={!canPublish || isPublishing} onClick={() => onPublishCourse(course)}>
          {isPublishing ? "Publishing..." : canPublish ? "Publish course" : "Resolve gates before publishing"}
        </button>
      )}
    </section>
  );
}

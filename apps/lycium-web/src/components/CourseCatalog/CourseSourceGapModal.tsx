import { useMemo, useState, type FormEvent } from "react";
import type { CourseEntry } from "../../courseTypes";
import Dropdown from "../Dropdown/Dropdown";
import Modal from "../Modal/Modal";
import { getCourseSourceGapSuggestions, sourceGapSummary } from "../../utils/courseSourceGaps";

type CourseSourceGapModalProps = {
  course: CourseEntry;
  onClose: () => void;
  onQueueSource: (course: CourseEntry, gapId: string, url: string, description: string) => void | Promise<void>;
};

export default function CourseSourceGapModal({ course, onClose, onQueueSource }: CourseSourceGapModalProps) {
  const summary = sourceGapSummary(course);
  const suggestions = getCourseSourceGapSuggestions(course);
  const firstGapId = summary.gaps[0]?.id ?? "";
  const [selectedGapId, setSelectedGapId] = useState(firstGapId);
  const [sourceUrl, setSourceUrl] = useState("");
  const [description, setDescription] = useState("");
  const [queuedCount, setQueuedCount] = useState(0);
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const selectedGap = summary.gaps.find((gap) => gap.id === selectedGapId) ?? summary.gaps[0];
  const suggestionsByGap = useMemo(
    () =>
      suggestions.reduce<Record<string, typeof suggestions>>((groups, suggestion) => {
        groups[suggestion.gapId] = [...(groups[suggestion.gapId] ?? []), suggestion];
        return groups;
      }, {}),
    [suggestions],
  );
  const gapOptions = useMemo(
    () =>
      summary.gaps.map((gap) => ({
        value: gap.id,
        label: `${gap.severity === "blocking" ? "Required" : "Recommended"}: ${gap.title}`,
      })),
    [summary.gaps],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedUrl = sourceUrl.trim();
    if (!selectedGap || !trimmedUrl) return;
    setIsSubmitting(true);
    setSubmitError("");
    try {
      await onQueueSource(course, selectedGap.id, trimmedUrl, description);
      setSourceUrl("");
      setDescription("");
      setQueuedCount((count) => count + 1);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Could not add source.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen
      title={course.title}
      eyebrow="Sources needed"
      labelledById="course-source-gap-title"
      size="lg"
      className="course-source-gap-modal"
      onClose={onClose}
    >
      <p className="course-source-gap-intro">
        This course is a draft. Lycium needs more source evidence before it can generate a full learner-facing course.
      </p>
      <div className="course-source-gap-summary" aria-label="Source coverage summary">
        <article>
          <strong>{summary.blockingGaps.length}</strong>
          <span>blocking gaps</span>
        </article>
        <article>
          <strong>{summary.currentSourceCount}/{summary.requiredSourceCount}</strong>
          <span>source coverage</span>
        </article>
        <article>
          <strong>{suggestions.length + queuedCount}</strong>
          <span>queued suggestions</span>
        </article>
      </div>
      <section className="course-source-gap-policy" aria-label="Source coverage policy">
        <h3>Coverage policy</h3>
        <div>
          <span>Course sources: {summary.currentSourceCount}/{summary.requiredSourceCount}</span>
          <span>Module minimum: {summary.policy.minimumSourcesPerModule ?? "not set"}</span>
          <span>Concept coverage: {summary.policy.minimumRequiredConceptCoveragePercent ?? "not set"}%</span>
          <span>Assessment evidence: {summary.policy.requireAssessmentCoverage ? "required" : "optional"}</span>
          <span>Benchmark evidence: {summary.policy.requireBenchmarkEvidence ? "required" : "optional"}</span>
        </div>
      </section>
      {Boolean(summary.requiredConcepts.length || summary.suggestedSourceTypes.length) && (
        <section className="course-source-gap-overview" aria-label="Required concept and source type overview">
          {Boolean(summary.requiredConcepts.length) && (
            <article>
              <h3>Concepts needing evidence</h3>
              <div>
                {summary.requiredConcepts.map((concept) => (
                  <span key={concept}>{concept}</span>
                ))}
              </div>
            </article>
          )}
          {Boolean(summary.suggestedSourceTypes.length) && (
            <article>
              <h3>Useful source types</h3>
              <div>
                {summary.suggestedSourceTypes.map((sourceType) => (
                  <span key={sourceType}>{sourceType.replace(/_/g, " ")}</span>
                ))}
              </div>
            </article>
          )}
        </section>
      )}
      <section className="course-source-gap-list" aria-label="Course source gaps">
        {summary.gaps.map((gap) => (
          <article className={`course-source-gap-card course-source-gap-card-${gap.severity}`} key={gap.id}>
            <div>
              <h3>{gap.title}</h3>
              <span>{gap.severity}</span>
            </div>
            <p>{gap.neededFor}</p>
            <div className="course-source-gap-meta">
              <span>{gap.currentSourceCount}/{gap.minimumUsefulSources} useful sources</span>
              {gap.scopeType && <span>{gap.scopeType}</span>}
              {(gap.recommendedSourceTypes ?? []).slice(0, 4).map((sourceType) => (
                <span key={sourceType}>{sourceType.replace(/_/g, " ")}</span>
              ))}
            </div>
            {Boolean(gap.requiredConcepts?.length) && (
              <div className="course-source-gap-concepts">
                {gap.requiredConcepts?.map((concept) => <span key={concept}>{concept}</span>)}
              </div>
            )}
            {Boolean(suggestionsByGap[gap.id]?.length) && (
              <div className="course-source-gap-suggestions" aria-label={`Queued sources for ${gap.title}`}>
                <strong>Queued sources</strong>
                {suggestionsByGap[gap.id].map((suggestion) => (
                  <a href={suggestion.url} target="_blank" rel="noreferrer" key={suggestion.id}>
                    {suggestion.description || suggestion.url}
                  </a>
                ))}
              </div>
            )}
          </article>
        ))}
      </section>
      <form className="course-source-gap-form" onSubmit={handleSubmit}>
        {selectedGap && (
          <div className="course-source-gap-selected">
            <strong>Add source for</strong>
            <span>{selectedGap.title}</span>
            <p>{selectedGap.neededFor}</p>
          </div>
        )}
        <Dropdown
          className="course-source-gap-dropdown"
          value={selectedGapId}
          options={gapOptions}
          onChange={setSelectedGapId}
          ariaLabel="Source gap"
          placeholder="Choose source gap"
        />
        <input
          type="url"
          value={sourceUrl}
          disabled={isSubmitting}
          onChange={(event) => setSourceUrl(event.target.value)}
          placeholder="https://example.edu/source"
          aria-label="Source URL"
        />
        <textarea
          value={description}
          disabled={isSubmitting}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Optional note about how this source fits"
          aria-label="Source fit note"
          rows={3}
        />
        <button type="submit" disabled={isSubmitting || !selectedGap || !sourceUrl.trim()}>
          {isSubmitting ? "Adding..." : course.snapshotId ? "Add source and resume" : "Queue source"}
        </button>
        {submitError && <p className="course-source-gap-error">{submitError}</p>}
      </form>
    </Modal>
  );
}

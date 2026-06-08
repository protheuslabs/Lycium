import { useCallback, useState, type FormEvent } from "react";
import Button from "../Button/Button";
import Modal from "../Modal/Modal";

type SourceRow = {
  id: string;
  title: string;
  citationIndex: string | number | null;
};

type SectionRefreshControlProps = {
  canRegenerateSection: boolean;
  sourceRows: SourceRow[];
  onRegenerateSection?: (payload: {
    feedback?: string;
    positiveFeedback?: string[];
    negativeFeedback?: string[];
    newSourceUrls?: string[];
    badSourceIds?: string[];
  }) => Promise<unknown> | unknown;
};

const splitLines = (value: string) =>
  value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

export default function SectionRefreshControl({
  canRegenerateSection,
  sourceRows,
  onRegenerateSection,
}: SectionRefreshControlProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [positiveFeedback, setPositiveFeedback] = useState("");
  const [negativeFeedback, setNegativeFeedback] = useState("");
  const [sourceUrls, setSourceUrls] = useState("");
  const [badSourceIds, setBadSourceIds] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!onRegenerateSection) return;

      setIsRefreshing(true);
      setStatus("Refreshing this section...");
      try {
        await onRegenerateSection({
          feedback,
          positiveFeedback: splitLines(positiveFeedback),
          negativeFeedback: splitLines(negativeFeedback),
          newSourceUrls: splitLines(sourceUrls),
          badSourceIds: Array.from(badSourceIds),
        });
        setIsOpen(false);
        setStatus("");
      } catch (err) {
        setStatus(err instanceof Error ? err.message : "Section refresh failed.");
      } finally {
        setIsRefreshing(false);
      }
    },
    [badSourceIds, feedback, negativeFeedback, onRegenerateSection, positiveFeedback, sourceUrls],
  );

  const toggleBadSource = (sourceId: string, checked: boolean) => {
    setBadSourceIds((current) => {
      const next = new Set(current);
      if (checked) next.add(sourceId);
      else next.delete(sourceId);
      return next;
    });
  };

  return (
    <>
      <Button
        type="button"
        variant="icon"
        iconOnly
        className="section-refresh-button"
        disabled={!canRegenerateSection || isRefreshing}
        title={canRegenerateSection ? "Refresh this section with AI" : "Section refresh needs an API-backed snapshot and verified AI model"}
        aria-label="Refresh this section with AI"
        onClick={() => setIsOpen(true)}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
          <path d="M20 6v5h-5" />
          <path d="M4 18v-5h5" />
          <path d="M18.5 9A7 7 0 0 0 6.4 6.7L4 9" />
          <path d="M5.5 15a7 7 0 0 0 12.1 2.3L20 15" />
        </svg>
      </Button>
      <Modal
        isOpen={isOpen}
        title="Refresh this section"
        eyebrow="AI section revision"
        labelledById="section-refresh-modal-title"
        size="md"
        onClose={() => {
          if (!isRefreshing) {
            setIsOpen(false);
            setStatus("");
          }
        }}
      >
        <form className="section-refresh-form" onSubmit={handleSubmit}>
          <label>
            <span>Overall direction</span>
            <textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="What should the model improve or preserve in this section?" disabled={isRefreshing} />
          </label>
          <label>
            <span>Keep or strengthen</span>
            <textarea value={positiveFeedback} onChange={(event) => setPositiveFeedback(event.target.value)} placeholder="One positive note per line" disabled={isRefreshing} />
          </label>
          <label>
            <span>Fix or avoid</span>
            <textarea value={negativeFeedback} onChange={(event) => setNegativeFeedback(event.target.value)} placeholder="One negative note per line" disabled={isRefreshing} />
          </label>
          <label>
            <span>New sources</span>
            <textarea value={sourceUrls} onChange={(event) => setSourceUrls(event.target.value)} placeholder={"https://example.edu/source\nhttps://openstax.org/..."} disabled={isRefreshing} />
          </label>
          {sourceRows.length > 0 && (
            <fieldset className="section-refresh-source-fieldset">
              <legend>Sources to avoid</legend>
              {sourceRows.map((source) => (
                <label className="section-refresh-source-row" key={source.id}>
                  <input type="checkbox" checked={badSourceIds.has(source.id)} disabled={isRefreshing} onChange={(event) => toggleBadSource(source.id, event.target.checked)} />
                  <span>[{source.citationIndex ?? "?"}] {source.title}</span>
                </label>
              ))}
            </fieldset>
          )}
          <div className="section-refresh-footer">
            {status && <p>{status}</p>}
            <Button type="submit" variant="standard" disabled={isRefreshing || !canRegenerateSection}>
              {isRefreshing ? "Refreshing..." : "Refresh section"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

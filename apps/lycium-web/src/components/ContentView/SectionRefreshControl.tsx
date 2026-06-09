import { useCallback, useEffect, useState, type CSSProperties } from "react";
import Button from "../Button/Button";
import ConfirmModal from "../ConfirmModal/ConfirmModal";
import Modal from "../Modal/Modal";
import AiConnectionLockCallout from "../AiConnectionLockCallout/AiConnectionLockCallout";
import { browserPathForRoute, SETTINGS_PATH } from "../../utils/courseRouting";

type SectionRefreshControlProps = {
  canRegenerateSection: boolean;
  lockedReason?: string;
  lockedAction?: "settings" | null;
  onRegenerateSection?: (payload: {
    feedback?: string;
    positiveFeedback?: string[];
    negativeFeedback?: string[];
    newSourceUrls?: string[];
    badSourceIds?: string[];
  }) => Promise<unknown> | unknown;
};

export default function SectionRefreshControl({
  canRegenerateSection,
  lockedReason = "Section refresh needs an API-backed snapshot and verified AI model.",
  lockedAction = null,
  onRegenerateSection,
}: SectionRefreshControlProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLockedOpen, setIsLockedOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState(0);

  useEffect(() => {
    if (!isRefreshing) return;
    const intervalId = window.setInterval(() => {
      setRefreshProgress((current) => Math.min(95, current + Math.max(1, Math.round((96 - current) * 0.12))));
    }, 420);

    return () => window.clearInterval(intervalId);
  }, [isRefreshing]);

  const handleConfirmRegenerate = useCallback(
    async () => {
      if (!onRegenerateSection) return;

      setIsRefreshing(true);
      setRefreshProgress(8);
      setIsOpen(false);
      setStatus("Refreshing this section...");
      try {
        await onRegenerateSection({});
        setRefreshProgress(100);
        setStatus("");
      } catch (err) {
        setStatus(err instanceof Error ? err.message : "Section refresh failed.");
      } finally {
        window.setTimeout(() => {
          setIsRefreshing(false);
          setRefreshProgress(0);
        }, 420);
      }
    },
    [onRegenerateSection],
  );

  const handleRefreshClick = () => {
    if (!canRegenerateSection) {
      setIsLockedOpen(true);
      return;
    }
    setIsOpen(true);
  };

  return (
    <>
      {isRefreshing ? (
        <span
          className="section-refresh-ring course-feedback-nav-button"
          style={{ "--section-refresh-progress": `${refreshProgress}%` } as CSSProperties}
          aria-label={`Regenerating section, ${refreshProgress}% complete`}
          role="status"
        >
          <span className="section-refresh-ring-core" />
        </span>
      ) : (
        <Button
          type="button"
          variant="icon"
          iconOnly
          className={`section-refresh-button course-feedback-nav-button${canRegenerateSection ? "" : " section-refresh-button-locked"}`}
          title={canRegenerateSection ? "Refresh this section with AI" : lockedReason}
          aria-label={canRegenerateSection ? "Refresh this section with AI" : "Refresh unavailable"}
          aria-disabled={!canRegenerateSection}
          onClick={handleRefreshClick}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
            <path d="M20 6v5h-5" />
            <path d="M4 18v-5h5" />
            <path d="M18.5 9A7 7 0 0 0 6.4 6.7L4 9" />
            <path d="M5.5 15a7 7 0 0 0 12.1 2.3L20 15" />
          </svg>
        </Button>
      )}
      {status && <span className="section-refresh-status" aria-live="polite">{status}</span>}
      <Modal
        isOpen={isLockedOpen}
        title="Section refresh unavailable"
        eyebrow="AI connection needed"
        labelledById="section-refresh-locked-modal-title"
        describedById="section-refresh-locked-modal-description"
        size="sm"
        onClose={() => setIsLockedOpen(false)}
      >
        <div className="section-refresh-locked">
          <AiConnectionLockCallout
            title="AI section refresh is locked."
            titleId="section-refresh-locked-callout-title"
            message={lockedReason}
            messageId="section-refresh-locked-modal-description"
            href={browserPathForRoute(SETTINGS_PATH)}
            showAction={lockedAction === "settings"}
          />
          <div className="section-refresh-footer">
            <Button type="button" variant="standard" onClick={() => setIsLockedOpen(false)}>Close</Button>
          </div>
        </div>
      </Modal>
      <ConfirmModal
        isOpen={isOpen}
        title="Regenerate section?"
        eyebrow="AI section revision"
        labelledById="section-refresh-modal-title"
        message="This will ask the selected model to regenerate the current section using the course context and available sources."
        confirmLabel="Yes, regenerate"
        confirmDisabled={!canRegenerateSection}
        onCancel={() => {
          setIsOpen(false);
          setStatus("");
        }}
        onConfirm={handleConfirmRegenerate}
      />
    </>
  );
}

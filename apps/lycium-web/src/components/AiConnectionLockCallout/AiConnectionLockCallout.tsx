import { useId } from "react";
import type { MouseEvent } from "react";
import "./AiConnectionLockCallout.css";

type AiConnectionLockCalloutProps = {
  title?: string;
  titleId?: string;
  message?: string;
  messageId?: string;
  actionLabel?: string;
  href?: string;
  showAction?: boolean;
  onOpenSettings?: (event: MouseEvent<HTMLAnchorElement>) => void;
};

export default function AiConnectionLockCallout({
  title = "AI features are locked.",
  titleId,
  message = "Connect and verify an AI model in Settings to use this feature.",
  messageId,
  actionLabel = "Open Settings",
  href = "/settings",
  showAction = true,
  onOpenSettings,
}: AiConnectionLockCalloutProps) {
  const generatedTitleId = useId();
  const generatedMessageId = useId();
  const resolvedTitleId = titleId ?? generatedTitleId;
  const resolvedMessageId = messageId ?? generatedMessageId;

  return (
    <div
      className="ai-connection-lock-callout"
      role="note"
      aria-labelledby={resolvedTitleId}
      aria-describedby={resolvedMessageId}
    >
      <div className="ai-connection-lock-copy">
        <strong id={resolvedTitleId}>{title}</strong>
        <span id={resolvedMessageId}>{message}</span>
      </div>
      {showAction && (
        <a className="ai-connection-lock-button" href={href} onClick={onOpenSettings}>
          <SettingsIcon />
          <span>{actionLabel}</span>
        </a>
      )}
    </div>
  );
}

function SettingsIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path d="M19.43 12.98c.04-.32.07-.65.07-.98s-.02-.66-.07-.98l2.06-1.6a.5.5 0 0 0 .12-.64l-1.95-3.37a.5.5 0 0 0-.6-.22l-2.43.98a7.3 7.3 0 0 0-1.69-.98l-.37-2.58A.5.5 0 0 0 14.08 2h-3.9a.5.5 0 0 0-.5.42L9.32 5a7.43 7.43 0 0 0-1.69.98L5.2 5a.5.5 0 0 0-.6.22L2.65 8.59a.5.5 0 0 0 .12.64l2.06 1.6c-.04.32-.08.65-.08.98s.03.66.08.98l-2.06 1.6a.5.5 0 0 0-.12.64l1.95 3.37c.13.22.39.31.6.22l2.43-.98c.52.4 1.08.73 1.69.98l.37 2.58c.04.24.25.42.5.42h3.9c.25 0 .46-.18.5-.42l.37-2.58a7.43 7.43 0 0 0 1.69-.98l2.43.98c.22.08.48 0 .6-.22l1.95-3.37a.5.5 0 0 0-.12-.64l-2.07-1.6ZM12.13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z" />
    </svg>
  );
}

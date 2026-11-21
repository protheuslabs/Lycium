import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useClientMounted } from "../../hooks/useClientMounted";
import { containDialogFocus } from "../../utils/dialogFocus";
import "./Modal.css";

type ModalSize = "sm" | "md" | "lg";

type ModalProps = {
  isOpen: boolean;
  title: string;
  eyebrow?: string;
  labelledById: string;
  describedById?: string;
  size?: ModalSize;
  className?: string;
  initialFocus?: string;
  children: ReactNode;
  onClose: () => void;
};

export default function Modal({
  isOpen,
  title,
  eyebrow,
  labelledById,
  describedById,
  size = "md",
  className = "",
  initialFocus,
  children,
  onClose,
}: ModalProps) {
  const mounted = useClientMounted();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!mounted || !isOpen) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    if (initialFocus) dialog.querySelector<HTMLElement>(initialFocus)?.focus();
    return () => {
      if (dialog.open) dialog.close();
      // Portal removal can precede native close behavior, so restore the opener explicitly.
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [mounted, isOpen, initialFocus]);

  if (!mounted || !isOpen || typeof document === "undefined") {
    return null;
  }

  const handleBackdropMouseDown = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) {
      // Keep the backdrop pointer event from stealing the restored trigger focus.
      event.preventDefault();
      onClose();
    }
  };

  return createPortal(
    <dialog
      ref={dialogRef}
      className="lycium-modal-backdrop"
      aria-modal="true"
      aria-labelledby={labelledById}
      aria-describedby={describedById}
      onMouseDown={handleBackdropMouseDown}
      onKeyDown={containDialogFocus}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <section
        className={`lycium-modal lycium-modal-${size} ${className}`.trim()}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          className="lycium-modal-close"
          type="button"
          aria-label={`Close ${title}`}
          onClick={onClose}
        >
          <X aria-hidden="true" />
        </button>
        <header className="lycium-modal-header">
          {eyebrow && <p>{eyebrow}</p>}
          <h2 id={labelledById}>{title}</h2>
        </header>
        {children}
      </section>
    </dialog>,
    document.body,
  );
}

import { useEffect, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import "./Modal.css";

type ModalSize = "sm" | "md" | "lg";

type ModalProps = {
  isOpen: boolean;
  title: string;
  eyebrow?: string;
  labelledById: string;
  size?: ModalSize;
  className?: string;
  children: ReactNode;
  onClose: () => void;
};

export default function Modal({
  isOpen,
  title,
  eyebrow,
  labelledById,
  size = "md",
  className = "",
  children,
  onClose,
}: ModalProps) {
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === "undefined") {
    return null;
  }

  const handleBackdropMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return createPortal(
    <div className="lycium-modal-backdrop" role="presentation" onMouseDown={handleBackdropMouseDown}>
      <section
        className={`lycium-modal lycium-modal-${size} ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledById}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="lycium-modal-close" type="button" aria-label={`Close ${title}`} onClick={onClose}>
          <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
            <path d="M6.3 5.3a1 1 0 0 1 1.4 0l4.3 4.3 4.3-4.3a1 1 0 1 1 1.4 1.4L13.4 11l4.3 4.3a1 1 0 0 1-1.4 1.4L12 12.4l-4.3 4.3a1 1 0 0 1-1.4-1.4l4.3-4.3-4.3-4.3a1 1 0 0 1 0-1.4Z" />
          </svg>
        </button>
        <header className="lycium-modal-header">
          {eyebrow && <p>{eyebrow}</p>}
          <h2 id={labelledById}>{title}</h2>
        </header>
        {children}
      </section>
    </div>,
    document.body,
  );
}

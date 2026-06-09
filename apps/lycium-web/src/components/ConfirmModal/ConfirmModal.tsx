import { useEffect, useId, useRef } from "react";
import Button from "../Button/Button";
import Modal from "../Modal/Modal";
import "./ConfirmModal.css";

type ConfirmTone = "neutral" | "danger";

/**
 * Standard confirmation modal for actions that should not happen by accident.
 * It focuses Cancel when opened so destructive flows default to the safe action.
 */
type ConfirmModalProps = {
  isOpen: boolean;
  title: string;
  message: string;
  eyebrow?: string;
  labelledById?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  confirmDisabled?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function ConfirmModal({
  isOpen,
  title,
  message,
  eyebrow,
  labelledById,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "neutral",
  confirmDisabled = false,
  onCancel,
  onConfirm,
}: ConfirmModalProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const generatedLabelId = useId();
  const resolvedLabelId = labelledById ?? generatedLabelId;
  const descriptionId = `${resolvedLabelId}-description`;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    cancelButtonRef.current?.focus();
  }, [isOpen]);

  return (
    <Modal
      isOpen={isOpen}
      title={title}
      eyebrow={eyebrow}
      labelledById={resolvedLabelId}
      describedById={descriptionId}
      size="sm"
      onClose={onCancel}
    >
      <div className="confirm-modal-body">
        <p id={descriptionId}>{message}</p>
        <div className="confirm-modal-actions">
          <Button ref={cancelButtonRef} type="button" variant="standard" onClick={onCancel}>{cancelLabel}</Button>
          <Button
            type="button"
            variant="standard"
            className={tone === "danger" ? "confirm-modal-danger" : ""}
            disabled={confirmDisabled}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

import Modal from "../Modal/Modal";
import Button from "../Button/Button";
import "./ProgramStructureEditorModal.css";

type ProgramStructureEditorModalProps = {
  isOpen: boolean;
  kind: "program" | "cluster";
  mode: "create" | "edit";
  title: string;
  description: string;
  canDelete: boolean;
  confirmDeleteOpen: boolean;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onSave: () => void;
  onOpenSelector: () => void;
  onOpenDeleteConfirm: () => void;
  onCloseDeleteConfirm: () => void;
  onConfirmDelete: () => void;
  onClose: () => void;
};

export default function ProgramStructureEditorModal({
  isOpen,
  kind,
  mode,
  title,
  description,
  canDelete,
  confirmDeleteOpen,
  onTitleChange,
  onDescriptionChange,
  onSave,
  onOpenSelector,
  onOpenDeleteConfirm,
  onCloseDeleteConfirm,
  onConfirmDelete,
  onClose,
}: ProgramStructureEditorModalProps) {
  const noun = kind === "program" ? "program" : "cluster";
  const selectorLabel = kind === "program" ? "Add clusters" : "Add courses";
  const modalTitle = mode === "create" ? `Create ${noun}` : `Edit ${noun}`;

  return (
    <>
      <Modal
        isOpen={isOpen}
        title={modalTitle}
        eyebrow={kind === "program" ? "Program builder" : "Cluster builder"}
        labelledById={`program-structure-editor-${kind}`}
        size="md"
        className="program-structure-editor-modal"
        onClose={onClose}
      >
        <div className="program-structure-editor-body">
          <label className="program-structure-editor-field">
            <span>Name</span>
            <input
              type="text"
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              placeholder={kind === "program" ? "Program name" : "Cluster name"}
            />
          </label>
          <label className="program-structure-editor-field">
            <span>Description</span>
            <textarea
              value={description}
              onChange={(event) => onDescriptionChange(event.target.value)}
              placeholder={kind === "program" ? "Program description" : "Cluster description"}
              rows={5}
            />
          </label>
          <div className="program-structure-editor-actions">
            <Button variant="standard" onClick={onSave}>
              Save
            </Button>
            <Button variant="standard" onClick={onOpenSelector}>
              {selectorLabel}
            </Button>
            {canDelete && (
              <Button variant="standard" tone="negative" onClick={onOpenDeleteConfirm}>
                Delete {noun}
              </Button>
            )}
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={confirmDeleteOpen}
        title={`Delete ${noun}`}
        eyebrow="Confirm delete"
        labelledById={`program-structure-delete-${kind}`}
        size="sm"
        className="program-structure-delete-modal"
        onClose={onCloseDeleteConfirm}
      >
        <div className="program-structure-delete-body">
          <p>Are you sure? This can&apos;t be undone.</p>
          <div className="program-structure-editor-actions">
            <Button variant="standard" tone="negative" onClick={onConfirmDelete}>
              Delete
            </Button>
            <Button variant="standard" onClick={onCloseDeleteConfirm}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

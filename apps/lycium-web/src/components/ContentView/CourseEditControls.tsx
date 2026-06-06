type EditPencilButtonProps = {
  label: string;
  onClick: () => void;
};

export function promptForText(label: string, currentValue: string | undefined, onSave: (value: string) => void) {
  if (typeof document === "undefined") {
    return;
  }

  const dialog = document.createElement("dialog");
  const form = document.createElement("form");
  const fieldLabel = document.createElement("label");
  const field =
    (currentValue?.length ?? 0) > 90 || /block|body|description/i.test(label)
      ? document.createElement("textarea")
      : document.createElement("input");
  const actions = document.createElement("div");
  const cancelButton = document.createElement("button");
  const saveButton = document.createElement("button");

  dialog.className = "lycium-modal lycium-modal-md course-edit-native-dialog";
  form.className = "course-edit-native-form";
  fieldLabel.className = "course-edit-native-label";
  field.className = "course-edit-native-field";
  actions.className = "course-edit-native-actions";
  cancelButton.className = "course-edit-native-button course-edit-native-button--secondary";
  saveButton.className = "course-edit-native-button";

  form.method = "dialog";
  fieldLabel.textContent = label;
  fieldLabel.htmlFor = "course-edit-native-field";
  field.id = "course-edit-native-field";
  field.value = currentValue ?? "";
  if (field instanceof HTMLTextAreaElement) {
    field.rows = 8;
  }
  cancelButton.type = "button";
  cancelButton.textContent = "Cancel";
  saveButton.type = "submit";
  saveButton.textContent = "Save";

  const closeDialog = () => {
    dialog.close();
    dialog.remove();
  };

  cancelButton.addEventListener("click", closeDialog);
  dialog.addEventListener("cancel", () => dialog.remove());
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    onSave(field.value);
    closeDialog();
  });

  actions.append(cancelButton, saveButton);
  form.append(fieldLabel, field, actions);
  dialog.append(form);
  document.body.append(dialog);
  dialog.showModal();
  field.focus();
}

export function EditPencilButton({ label, onClick }: EditPencilButtonProps) {
  return (
    <button className="course-edit-pencil" type="button" aria-label={label} title={label} onClick={onClick}>
      <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
        <path d="M4 17.5V20h2.5L17.8 8.7l-2.5-2.5L4 17.5Zm13.2-12.3 1.1-1.1a1.4 1.4 0 0 1 2 0l.6.6a1.4 1.4 0 0 1 0 2l-1.1 1.1-2.6-2.6Z" />
      </svg>
    </button>
  );
}

type EditPencilButtonProps = {
  label: string;
  onClick: () => void;
};

type DeleteBlockButtonProps = {
  label: string;
  onClick: () => void;
};

export type CourseEditBlockKind = "text" | "card" | "video" | "iframe" | "heading" | "quiz";

const blockTypeOptions: Array<{
  kind: CourseEditBlockKind;
  label: string;
  description: string;
  fieldLabel: string;
  placeholder: string;
  defaultValue: string;
  rows: number;
}> = [
  {
    kind: "text",
    label: "Text",
    description: "Instructional paragraph block with an optional heading.",
    fieldLabel: "Text content",
    placeholder: "Write the learner-facing explanation for this block.",
    defaultValue: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Replace this text with learner-facing instruction.",
    rows: 7,
  },
  {
    kind: "card",
    label: "Card",
    description: "Single concept card for one named idea or definition.",
    fieldLabel: "Concept description",
    placeholder: "Describe the concept this card should introduce.",
    defaultValue: "Lorem ipsum dolor sit amet. Replace this with a concise concept definition.",
    rows: 5,
  },
  {
    kind: "video",
    label: "Video",
    description: "Video embed block, including YouTube clips when a URL is supplied.",
    fieldLabel: "Video URL",
    placeholder: "Paste a video URL or embed URL.",
    defaultValue: "",
    rows: 2,
  },
  {
    kind: "iframe",
    label: "iframe",
    description: "Generic embedded web resource for interactive or external material.",
    fieldLabel: "iframe URL",
    placeholder: "Paste the URL for the embedded resource.",
    defaultValue: "",
    rows: 2,
  },
  {
    kind: "heading",
    label: "Heading",
    description: "Standalone heading for grouping related blocks.",
    fieldLabel: "Heading text",
    placeholder: "Write the heading text.",
    defaultValue: "Heading title",
    rows: 2,
  },
  {
    kind: "quiz",
    label: "Quiz",
    description: "Assessment-only quiz block with a starter question template.",
    fieldLabel: "Quiz title",
    placeholder: "Write the quiz title.",
    defaultValue: "Quiz title",
    rows: 2,
  },
];

function getBlockTypeOption(kind: CourseEditBlockKind) {
  return blockTypeOptions.find((option) => option.kind === kind) ?? blockTypeOptions[0]!;
}

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
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      closeDialog();
    }
  });
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

export function promptForBlockType(onSelect: (kind: CourseEditBlockKind, initialValue: string) => void) {
  if (typeof document === "undefined") {
    return;
  }

  let selectedKind: CourseEditBlockKind = "text";
  const selectedOption = () => getBlockTypeOption(selectedKind);
  const dialog = document.createElement("dialog");
  const form = document.createElement("form");
  const label = document.createElement("p");
  const tabs = document.createElement("div");
  const description = document.createElement("p");
  const fieldLabel = document.createElement("label");
  const field = document.createElement("textarea");
  const actions = document.createElement("div");
  const cancelButton = document.createElement("button");
  const addButton = document.createElement("button");
  const tabButtons = blockTypeOptions.map((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `course-edit-native-tab ${option.kind === selectedKind ? "course-edit-native-tab--active" : ""}`;
    button.textContent = option.label;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", String(option.kind === selectedKind));
    button.addEventListener("click", () => {
      selectedKind = option.kind;
      description.textContent = option.description;
      fieldLabel.textContent = option.fieldLabel;
      field.placeholder = option.placeholder;
      field.value = option.defaultValue;
      field.rows = option.rows;
      for (const currentButton of tabButtons) {
        const isSelected = currentButton.dataset.kind === selectedKind;
        currentButton.classList.toggle("course-edit-native-tab--active", isSelected);
        currentButton.setAttribute("aria-selected", String(isSelected));
      }
    });
    button.dataset.kind = option.kind;
    return button;
  });

  dialog.className = "lycium-modal lycium-modal-md course-edit-native-dialog";
  form.className = "course-edit-native-form";
  label.className = "course-edit-native-label";
  tabs.className = "course-edit-native-tabs";
  description.className = "course-edit-native-choice";
  fieldLabel.className = "course-edit-native-label";
  field.className = "course-edit-native-field";
  actions.className = "course-edit-native-actions";
  cancelButton.className = "course-edit-native-button course-edit-native-button--secondary";
  addButton.className = "course-edit-native-button";

  form.method = "dialog";
  label.textContent = "Add block";
  tabs.setAttribute("role", "tablist");
  description.textContent = selectedOption().description;
  fieldLabel.textContent = selectedOption().fieldLabel;
  field.placeholder = selectedOption().placeholder;
  field.value = selectedOption().defaultValue;
  field.rows = selectedOption().rows;
  cancelButton.type = "button";
  cancelButton.textContent = "Cancel";
  addButton.type = "submit";
  addButton.textContent = "Add block";

  const closeDialog = () => {
    dialog.close();
    dialog.remove();
  };

  cancelButton.addEventListener("click", closeDialog);
  dialog.addEventListener("cancel", () => dialog.remove());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      closeDialog();
    }
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    onSelect(selectedKind, field.value);
    closeDialog();
  });

  tabs.append(...tabButtons);
  actions.append(cancelButton, addButton);
  form.append(label, tabs, description, fieldLabel, field, actions);
  dialog.append(form);
  document.body.append(dialog);
  dialog.showModal();
  field.focus();
}

export function promptForDeleteBlock(
  onConfirm: () => void,
  title = "Delete block",
  messageText = "Are you sure you want to delete this block?",
) {
  if (typeof document === "undefined") {
    return;
  }

  const dialog = document.createElement("dialog");
  const form = document.createElement("form");
  const label = document.createElement("p");
  const message = document.createElement("p");
  const actions = document.createElement("div");
  const cancelButton = document.createElement("button");
  const deleteButton = document.createElement("button");

  dialog.className = "lycium-modal lycium-modal-sm course-edit-native-dialog";
  form.className = "course-edit-native-form";
  label.className = "course-edit-native-label";
  message.className = "course-edit-native-choice";
  actions.className = "course-edit-native-actions";
  cancelButton.className = "course-edit-native-button course-edit-native-button--secondary";
  deleteButton.className = "course-edit-native-button course-edit-native-button--danger";

  form.method = "dialog";
  label.textContent = title;
  message.textContent = messageText;
  cancelButton.type = "button";
  cancelButton.textContent = "Cancel";
  deleteButton.type = "submit";
  deleteButton.textContent = "Delete";

  const closeDialog = () => {
    dialog.close();
    dialog.remove();
  };

  cancelButton.addEventListener("click", closeDialog);
  dialog.addEventListener("cancel", () => dialog.remove());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      closeDialog();
    }
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    onConfirm();
    closeDialog();
  });

  actions.append(cancelButton, deleteButton);
  form.append(label, message, actions);
  dialog.append(form);
  document.body.append(dialog);
  dialog.showModal();
  cancelButton.focus();
}

export function EditPencilButton({ label, onClick }: EditPencilButtonProps) {
  return (
    <button
      className="course-edit-pencil"
      type="button"
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
        <path d="M4 17.5V20h2.5L17.8 8.7l-2.5-2.5L4 17.5Zm13.2-12.3 1.1-1.1a1.4 1.4 0 0 1 2 0l.6.6a1.4 1.4 0 0 1 0 2l-1.1 1.1-2.6-2.6Z" />
      </svg>
    </button>
  );
}

export function DeleteBlockButton({ label, onClick }: DeleteBlockButtonProps) {
  return (
    <button
      className="course-edit-delete"
      type="button"
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
        <path d="M6 7h12M10 11v6M14 11v6M9 7l.5-2h5l.5 2M8 7l1 13h6l1-13" />
      </svg>
    </button>
  );
}

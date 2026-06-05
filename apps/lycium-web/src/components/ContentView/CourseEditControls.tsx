type EditPencilButtonProps = {
  label: string;
  onClick: () => void;
};

export function promptForText(label: string, currentValue: string | undefined, onSave: (value: string) => void) {
  const nextValue = window.prompt(label, currentValue ?? "");
  if (nextValue === null) {
    return;
  }
  onSave(nextValue);
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


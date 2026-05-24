import { useState } from "react";
import type { FocusEvent } from "react";

export type DropdownOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type DropdownProps = {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
  disabled?: boolean;
  emptyLabel?: string;
  placeholder?: string;
};

export default function Dropdown({
  value,
  options,
  onChange,
  ariaLabel,
  className = "",
  disabled = false,
  emptyLabel = "No options available",
  placeholder = "Select",
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find((option) => option.value === value);

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsOpen(false);
    }
  };

  const handleSelect = (nextValue: string) => {
    onChange(nextValue);
    setIsOpen(false);
  };

  return (
    <div
      className={`dropdown ${isOpen ? "dropdown-open" : ""} ${className}`.trim()}
      onBlur={handleBlur}
    >
      <button
        className="dropdown-trigger"
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={disabled}
        onClick={() => setIsOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setIsOpen(false);
          }
        }}
      >
        <span className="dropdown-value">{selectedOption?.label ?? placeholder}</span>
        <svg className="dropdown-chevron" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>
      {isOpen && (
        <div className="dropdown-menu" role="listbox" aria-label={ariaLabel}>
          {options.length > 0 ? (
            options.map((option) => (
              <button
                className={`dropdown-option ${
                  option.value === value ? "dropdown-option-active" : ""
                }`.trim()}
                type="button"
                role="option"
                aria-selected={option.value === value}
                disabled={option.disabled}
                key={option.value}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  if (!option.disabled) {
                    handleSelect(option.value);
                  }
                }}
              >
                {option.label}
              </button>
            ))
          ) : (
            <span className="dropdown-empty">{emptyLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}

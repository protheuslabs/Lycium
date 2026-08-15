import { useState } from "react";
import type { FocusEvent } from "react";

type DropdownValueOption = {
  kind?: "option";
  value: string;
  label: string;
  disabled?: boolean;
  warning?: string | null;
  error?: string | null;
};

type DropdownSeparatorOption = {
  kind: "separator";
  label: string;
};

export type DropdownOption = DropdownValueOption | DropdownSeparatorOption;

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
  const selectedOption = options.find((option): option is DropdownValueOption =>
    option.kind !== "separator" && option.value === value
  );

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
            options.map((option) => {
              if (option.kind === "separator") {
                return (
                  <span className="dropdown-separator" role="separator" key={`separator-${option.label}`}>
                    {option.label}
                  </span>
                );
              }

              const issue = option.error || option.warning;
              const issueTone = option.error ? "error" : "warning";
              return (
                <button
                  className={`dropdown-option ${
                    option.value === value ? "dropdown-option-active" : ""
                  } ${
                    option.disabled ? "dropdown-option-disabled" : ""
                  }`.trim()}
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  aria-disabled={option.disabled ? "true" : undefined}
                  key={option.value}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    if (!option.disabled) {
                      handleSelect(option.value);
                    }
                  }}
                  onClick={() => {
                    if (!option.disabled) {
                      handleSelect(option.value);
                    }
                  }}
                >
                  <span className="dropdown-option-content">
                    <span className="dropdown-option-label">{option.label}</span>
                    {issue && (
                      <span
                        className={`dropdown-option-issue dropdown-option-issue-${issueTone}`}
                        aria-label={issue}
                        title={issue}
                        data-tooltip={issue}
                      >
                        !
                      </span>
                    )}
                  </span>
                </button>
              );
            })
          ) : (
            <span className="dropdown-empty">{emptyLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}

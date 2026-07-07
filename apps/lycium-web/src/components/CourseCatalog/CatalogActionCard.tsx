import type { KeyboardEvent, ReactNode } from "react";

type CatalogActionCardProps = {
  className: string;
  children: ReactNode;
  disabled?: boolean;
  onActivate: () => void;
  pressed?: boolean;
};

export default function CatalogActionCard({
  className,
  children,
  disabled = false,
  onActivate,
  pressed,
}: CatalogActionCardProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    if (!disabled) {
      onActivate();
    }
  };

  return (
    <article
      className={className}
      role="button"
      tabIndex={0}
      aria-disabled={disabled || undefined}
      aria-pressed={pressed}
      onClick={disabled ? undefined : onActivate}
      onKeyDown={handleKeyDown}
    >
      {children}
    </article>
  );
}

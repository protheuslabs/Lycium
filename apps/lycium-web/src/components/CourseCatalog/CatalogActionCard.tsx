import type { ReactNode } from "react";

type CatalogActionCardProps = {
  className: string;
  children: ReactNode;
  label: string;
  disabled?: boolean;
  onActivate: () => void;
  pressed?: boolean;
};

export default function CatalogActionCard({
  className,
  children,
  label,
  disabled = false,
  onActivate,
  pressed,
}: CatalogActionCardProps) {
  return (
    <article className={className}>
      <button
        className="catalog-card-action"
        type="button"
        aria-label={label}
        aria-pressed={pressed}
        disabled={disabled}
        onClick={onActivate}
      />
      {children}
    </article>
  );
}

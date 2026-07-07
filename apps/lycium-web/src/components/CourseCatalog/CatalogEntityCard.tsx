import type { ReactNode } from "react";
import CatalogActionCard from "./CatalogActionCard";

type CatalogEntityCardProps = {
  className: string;
  continuity?: ReactNode;
  description?: ReactNode;
  kicker: string;
  meta: string[];
  progress?: ReactNode;
  readiness?: ReactNode;
  selected?: boolean;
  title: string;
  onActivate: () => void;
};

export default function CatalogEntityCard({
  className,
  continuity,
  description,
  kicker,
  meta,
  progress,
  readiness,
  selected = false,
  title,
  onActivate,
}: CatalogEntityCardProps) {
  return (
    <CatalogActionCard
      className={`${className} ${selected ? "program-showcase-card--selected" : ""}`.trim()}
      onActivate={onActivate}
      pressed={selected || undefined}
    >
      <div className="program-showcase-copy">
        <p className="program-showcase-kicker">{kicker}</p>
        <h3>{title}</h3>
        {description && <p>{description}</p>}
      </div>
      <div className="program-showcase-meta">
        {meta.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
      {continuity}
      {readiness}
      {progress}
    </CatalogActionCard>
  );
}

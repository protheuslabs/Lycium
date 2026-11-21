import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import CatalogActionCard from "./CatalogActionCard";

type CatalogEntityCardProps = {
  className: string;
  continuity?: ReactNode;
  description?: ReactNode;
  kicker: string;
  meta: string[];
  detailsMeta?: string[];
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
  detailsMeta,
  progress,
  readiness,
  selected = false,
  title,
  onActivate,
}: CatalogEntityCardProps) {
  return (
    <CatalogActionCard
      label={`Open ${title}`}
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
      {progress}
      {(continuity || readiness || Boolean(detailsMeta?.length)) && (
        <details className="catalog-authoring-details">
          <summary><ChevronDown size={16} aria-hidden="true" />Authoring details</summary>
          <div className="catalog-authoring-content">
            {detailsMeta?.map((item) => <p key={item}>{item}</p>)}
            {continuity}
            {readiness}
          </div>
        </details>
      )}
    </CatalogActionCard>
  );
}

import type { ReactNode } from "react";
import CatalogActionCard from "./CatalogActionCard";

type CatalogEntityCardProps = {
  className: string;
  description?: string;
  kicker: string;
  meta: string[];
  progress?: ReactNode;
  title: string;
  onActivate: () => void;
};

export default function CatalogEntityCard({
  className,
  description,
  kicker,
  meta,
  progress,
  title,
  onActivate,
}: CatalogEntityCardProps) {
  return (
    <CatalogActionCard className={className} onActivate={onActivate}>
      <div>
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
    </CatalogActionCard>
  );
}

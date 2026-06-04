import type { LyciumProgram, LyciumRequirementGroup } from "@lycium/contracts";

type CatalogPathRowProps = {
  program: LyciumProgram | null;
  cluster: LyciumRequirementGroup | null;
  show: boolean;
  onNavigatePrograms: () => void;
  onNavigateProgram: () => void;
  onNavigateCluster: () => void;
};

export default function CatalogPathRow({
  program,
  cluster,
  show,
  onNavigatePrograms,
  onNavigateProgram,
  onNavigateCluster,
}: CatalogPathRowProps) {
  if (!show || !program) {
    return null;
  }

  const isClusterPath = Boolean(cluster);

  return (
    <nav className="catalog-path-row" aria-label="Catalog path">
      <ol>
        <li>
          <button type="button" onClick={onNavigatePrograms}>
            programs
          </button>
        </li>
        <li>
          <button type="button" aria-current={isClusterPath ? undefined : "page"} onClick={onNavigateProgram}>
            {program.title}
          </button>
        </li>
        {cluster && (
          <li>
            <button type="button" aria-current="page" onClick={onNavigateCluster}>
              {cluster.displayName}
            </button>
          </li>
        )}
      </ol>
    </nav>
  );
}

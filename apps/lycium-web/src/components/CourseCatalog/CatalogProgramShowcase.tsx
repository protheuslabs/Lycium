import type { LyciumProgram, LyciumRequirementGroup } from "@lycium/contracts";
import { formatTimeEstimate, timeEstimateSourceLabel } from "../../utils/curriculumTime";
import CatalogActionCard from "./CatalogActionCard";
import CatalogProgressMeter from "./CatalogProgressMeter";
import type { CatalogVisibleCluster, CatalogVisibleProgram } from "./catalogPathFiltering";

type CatalogProgramShowcaseProps = {
  viewLevel: "programs" | "clusters";
  programs: CatalogVisibleProgram[];
  clusters: CatalogVisibleCluster[];
  selectedProgram: LyciumProgram | null;
  onProgramSelect: (program: LyciumProgram) => void;
  onClusterSelect: (cluster: LyciumRequirementGroup) => void;
  onOpenProgram: (program: LyciumProgram) => void;
};

export default function CatalogProgramShowcase({
  viewLevel,
  programs,
  clusters,
  selectedProgram,
  onProgramSelect,
  onClusterSelect,
  onOpenProgram,
}: CatalogProgramShowcaseProps) {
  if (viewLevel === "programs") {
    return (
      <section className="program-showcase" aria-label="Learning programs">
        <div className="program-showcase-grid">
          {programs.map(({ program, estimate, progress }) => {
            return (
              <CatalogActionCard
                className="program-showcase-card"
                key={program.id}
                onActivate={() => onProgramSelect(program)}
              >
                <div>
                  <p className="program-showcase-kicker">{program.programType.replace(/_/g, " ")}</p>
                  <h3>{program.title}</h3>
                  <p>{program.description}</p>
                </div>
                <div className="program-showcase-meta">
                  <span>{program.requirementGroups.length} clusters</span>
                  <span>{formatTimeEstimate(estimate)}</span>
                  <span>{timeEstimateSourceLabel(estimate)}</span>
                  <span>{program.reviewStatus}</span>
                </div>
                {progress.hasProgress && (
                  <CatalogProgressMeter
                    percentage={progress.percentage}
                    viewedPercentage={progress.viewedPercentage}
                    variant="path"
                  />
                )}
              </CatalogActionCard>
            );
          })}
        </div>
      </section>
    );
  }

  if (!selectedProgram) {
    return null;
  }

  return (
    <section className="program-showcase" aria-label={`Clusters in ${selectedProgram.title}`}>
      <div className="program-showcase-grid">
        {clusters.map(({ cluster, courseIds, estimate, progress }) => {
          return (
            <CatalogActionCard
              className="program-showcase-card"
              key={cluster.id}
              onActivate={() => onClusterSelect(cluster)}
            >
              <div>
                <p className="program-showcase-kicker">{cluster.groupKind.replace(/_/g, " ")}</p>
                <h3>{cluster.displayName}</h3>
                <p>{cluster.purpose}</p>
              </div>
              <div className="program-showcase-meta">
                <span>{cluster.requirements.length} requirements</span>
                <span>{courseIds.length} courses</span>
                <span>{formatTimeEstimate(estimate)}</span>
                <span>{timeEstimateSourceLabel(estimate)}</span>
              </div>
              {progress.hasProgress && (
                <CatalogProgressMeter
                  percentage={progress.percentage}
                  viewedPercentage={progress.viewedPercentage}
                  variant="path"
                />
              )}
            </CatalogActionCard>
          );
        })}
      </div>
      <button className="program-open-detail-button" type="button" onClick={() => onOpenProgram(selectedProgram)}>
        Open full program detail
      </button>
    </section>
  );
}

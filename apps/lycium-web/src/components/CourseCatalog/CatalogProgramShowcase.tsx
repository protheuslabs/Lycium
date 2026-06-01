import type { LyciumProgram, LyciumRequirementGroup } from "@lycium/contracts";
import { formatTimeEstimate, timeEstimateSourceLabel } from "../../utils/curriculumTime";
import CatalogEntityCard from "./CatalogEntityCard";
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
              <CatalogEntityCard
                className="program-showcase-card"
                key={program.id}
                kicker={program.programType.replace(/_/g, " ")}
                title={program.title}
                description={program.description}
                meta={[
                  `${program.requirementGroups.length} clusters`,
                  formatTimeEstimate(estimate),
                  timeEstimateSourceLabel(estimate),
                  program.reviewStatus,
                ]}
                onActivate={() => onProgramSelect(program)}
                progress={
                  progress.hasProgress ? (
                  <CatalogProgressMeter
                    progress={progress}
                    variant="path"
                  />
                  ) : undefined
                }
              />
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
            <CatalogEntityCard
              className="program-showcase-card"
              key={cluster.id}
              kicker={cluster.groupKind.replace(/_/g, " ")}
              title={cluster.displayName}
              description={cluster.purpose}
              meta={[
                `${cluster.requirements.length} requirements`,
                `${courseIds.length} courses`,
                formatTimeEstimate(estimate),
                timeEstimateSourceLabel(estimate),
              ]}
              onActivate={() => onClusterSelect(cluster)}
              progress={
                progress.hasProgress ? (
                <CatalogProgressMeter
                  progress={progress}
                  variant="path"
                />
                ) : undefined
              }
            />
          );
        })}
      </div>
      <button className="program-open-detail-button" type="button" onClick={() => onOpenProgram(selectedProgram)}>
        Open full program detail
      </button>
    </section>
  );
}

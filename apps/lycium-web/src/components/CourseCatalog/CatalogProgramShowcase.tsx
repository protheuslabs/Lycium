import type { KeyboardEvent } from "react";
import type { LyciumProgram, LyciumRequirementGroup } from "@lycium/contracts";
import { formatTimeEstimate, timeEstimateSourceLabel } from "../../utils/curriculumTime";
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

function handleActivation(event: KeyboardEvent<HTMLElement>, action: () => void) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    action();
  }
}

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
              <article
                className="program-showcase-card"
                key={program.id}
                role="button"
                tabIndex={0}
                onClick={() => onProgramSelect(program)}
                onKeyDown={(event) => handleActivation(event, () => onProgramSelect(program))}
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
                  <div className="program-showcase-progress">
                    <div className="program-showcase-progress-bar">
                      <div className="program-showcase-progress-viewed" style={{ width: `${progress.viewedPercentage}%` }} />
                      <div className="program-showcase-progress-complete" style={{ width: `${progress.percentage}%` }} />
                    </div>
                    <p>
                      {Math.round(progress.percentage)}% complete &middot; {Math.round(progress.viewedPercentage)}% viewed
                    </p>
                  </div>
                )}
              </article>
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
            <article
              className="program-showcase-card"
              key={cluster.id}
              role="button"
              tabIndex={0}
              onClick={() => onClusterSelect(cluster)}
              onKeyDown={(event) => handleActivation(event, () => onClusterSelect(cluster))}
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
                <div className="program-showcase-progress">
                  <div className="program-showcase-progress-bar">
                    <div className="program-showcase-progress-viewed" style={{ width: `${progress.viewedPercentage}%` }} />
                    <div className="program-showcase-progress-complete" style={{ width: `${progress.percentage}%` }} />
                  </div>
                  <p>
                    {Math.round(progress.percentage)}% complete &middot; {Math.round(progress.viewedPercentage)}% viewed
                  </p>
                </div>
              )}
            </article>
          );
        })}
      </div>
      <button className="program-open-detail-button" type="button" onClick={() => onOpenProgram(selectedProgram)}>
        Open full program detail
      </button>
    </section>
  );
}

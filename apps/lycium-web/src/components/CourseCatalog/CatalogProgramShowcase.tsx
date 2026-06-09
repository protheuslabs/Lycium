import type { LyciumProgram, LyciumRequirementGroup } from "@lycium/contracts";
import { formatTimeEstimate, timeEstimateSourceLabel } from "../../utils/curriculumTime";
import CatalogEntityCard from "./CatalogEntityCard";
import CatalogProgressMeter from "./CatalogProgressMeter";
import type { CatalogPathContinuity } from "./catalogProgramProgress";
import type { CatalogVisibleCluster, CatalogVisibleProgram } from "./catalogPathFiltering";
import type { CatalogPathReadiness } from "./catalogPathReadiness";

type CatalogProgramShowcaseProps = {
  viewLevel: "programs" | "clusters";
  programs: CatalogVisibleProgram[];
  clusters: CatalogVisibleCluster[];
  selectedProgram: LyciumProgram | null;
  onProgramSelect: (program: LyciumProgram) => void;
  onClusterSelect: (cluster: LyciumRequirementGroup) => void;
};

function CatalogPathContinuityStrip({ continuity }: { continuity: CatalogPathContinuity }) {
  return (
    <div className={`path-continuity ${continuity.hasGaps ? "path-continuity--gaps" : ""}`}>
      <span>{continuity.mappedRequirements}/{continuity.totalRequirements} req mapped</span>
      <span>
        {continuity.availableCourseCount}/{continuity.courseCount} courses ready
      </span>
      {continuity.lockedCourseCount > 0 && <span>{continuity.lockedCourseCount} locked</span>}
      {continuity.missingCourseCount > 0 && <span>{continuity.missingCourseCount} missing</span>}
      <span>{continuity.sourceCount} sources</span>
      {continuity.capstoneCount > 0 && <span>{continuity.capstoneCount} capstone</span>}
      <strong>{continuity.nextLabel}</strong>
    </div>
  );
}

function CatalogPathReadinessStrip({ readiness }: { readiness: CatalogPathReadiness }) {
  return (
    <div className={`path-readiness path-readiness--${readiness.status}`} aria-label={`Path readiness: ${readiness.summaryLabel}`}>
      <strong>{readiness.summaryLabel}</strong>
      <span>{readiness.mappedRequirements}/{readiness.totalRequirements} requirements</span>
      <span>{readiness.sourceEvidenceCount} sources</span>
      {readiness.sourceSlotCount > 0 && (
        <span>{readiness.backedSourceSlotCount}/{readiness.sourceSlotCount} source slots</span>
      )}
      {readiness.sourceGapCount > 0 && <span>{readiness.sourceGapCount} source gaps</span>}
      {readiness.reviewCourseCount > 0 && <span>{readiness.reviewCourseCount} review drafts</span>}
      <em>{readiness.nextActionLabel}</em>
    </div>
  );
}

export default function CatalogProgramShowcase({
  viewLevel,
  programs,
  clusters,
  selectedProgram,
  onProgramSelect,
  onClusterSelect,
}: CatalogProgramShowcaseProps) {
  if (viewLevel === "programs") {
    return (
      <section className="program-showcase" aria-label="Learning programs">
        <div className="program-showcase-grid">
          {programs.map(({ program, estimate, progress, continuity, readiness }) => {
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
                continuity={<CatalogPathContinuityStrip continuity={continuity} />}
                readiness={<CatalogPathReadinessStrip readiness={readiness} />}
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
        {clusters.map(({ cluster, courseIds, estimate, progress, continuity, readiness }) => {
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
              continuity={<CatalogPathContinuityStrip continuity={continuity} />}
              readiness={<CatalogPathReadinessStrip readiness={readiness} />}
            />
          );
        })}
      </div>
    </section>
  );
}

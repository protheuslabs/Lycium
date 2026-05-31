import type { KeyboardEvent } from "react";
import type { LyciumProgram, LyciumRequirementGroup } from "@lycium/contracts";
import type { CourseEntry } from "../../courseTypes";
import { estimateProgramTime, estimateRequirementGroupTime, formatTimeEstimate, timeEstimateSourceLabel } from "../../utils/curriculumTime";
import { catalogPathProgress, groupCourseIds, programCourseIds } from "./catalogProgramProgress";

type CatalogProgramShowcaseProps = {
  viewLevel: "programs" | "clusters";
  programs: LyciumProgram[];
  selectedProgram: LyciumProgram | null;
  courses: CourseEntry[];
  courseMap: Map<string, CourseEntry>;
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
  selectedProgram,
  courses,
  courseMap,
  onProgramSelect,
  onClusterSelect,
  onOpenProgram,
}: CatalogProgramShowcaseProps) {
  if (viewLevel === "programs") {
    return (
      <section className="program-showcase" aria-label="Learning programs">
        <div className="program-showcase-grid">
          {programs.map((program) => {
            const programEstimate = estimateProgramTime(program, courses);
            const programProgress = catalogPathProgress(programCourseIds(program), courseMap);

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
                  <span>{formatTimeEstimate(programEstimate)}</span>
                  <span>{timeEstimateSourceLabel(programEstimate)}</span>
                  <span>{program.reviewStatus}</span>
                </div>
                {programProgress.hasProgress && (
                  <div className="program-showcase-progress">
                    <div className="program-showcase-progress-bar">
                      <div className="program-showcase-progress-viewed" style={{ width: `${programProgress.viewedPercentage}%` }} />
                      <div className="program-showcase-progress-complete" style={{ width: `${programProgress.percentage}%` }} />
                    </div>
                    <p>
                      {Math.round(programProgress.percentage)}% complete &middot; {Math.round(programProgress.viewedPercentage)}% viewed
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
        {selectedProgram.requirementGroups.map((cluster) => {
          const courseIds = groupCourseIds(cluster);
          const clusterEstimate = estimateRequirementGroupTime(cluster, courseMap);
          const clusterProgress = catalogPathProgress(courseIds, courseMap);

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
                <span>{formatTimeEstimate(clusterEstimate)}</span>
                <span>{timeEstimateSourceLabel(clusterEstimate)}</span>
              </div>
              {clusterProgress.hasProgress && (
                <div className="program-showcase-progress">
                  <div className="program-showcase-progress-bar">
                    <div className="program-showcase-progress-viewed" style={{ width: `${clusterProgress.viewedPercentage}%` }} />
                    <div className="program-showcase-progress-complete" style={{ width: `${clusterProgress.percentage}%` }} />
                  </div>
                  <p>
                    {Math.round(clusterProgress.percentage)}% complete &middot; {Math.round(clusterProgress.viewedPercentage)}% viewed
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

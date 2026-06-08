import type { LyciumRequirement, LyciumRequirementGroup } from "@lycium/contracts";
import type { CourseEntry } from "../../courseTypes";
import { sourceGapSummary } from "../../utils/courseSourceGaps";
import { getCourseLifecycleSummary } from "../../utils/courseLifecycle";
import { evaluateRequirementProgress, leafRequirements, type CourseProgressLookup } from "../../utils/programProgressRollup";

type CatalogRequirementRowsProps = {
  group: LyciumRequirementGroup;
  courseMap: Map<string, CourseEntry>;
  progressCache: CourseProgressLookup;
  onOpenCourse: (course: CourseEntry) => void;
  onOpenSourceGaps: (course: CourseEntry) => void;
};

type RequirementTarget = {
  id: string;
  label: string;
  type: "course" | "assessment" | "project" | "competency" | "hours";
  course?: CourseEntry;
};

function statusLabel(status: ReturnType<typeof evaluateRequirementProgress>["status"]): string {
  if (status === "complete") return "Complete";
  if (status === "in_progress") return "In progress";
  if (status === "missing") return "Missing";
  if (status === "blocked") return "Blocked";
  return "Not started";
}

function requirementTitle(requirement: LyciumRequirement): string {
  if (requirement.title?.trim()) return requirement.title;
  if (requirement.type === "complete_course") return "Complete course";
  if (requirement.type === "complete_n_of_courses") return `Complete ${requirement.count} courses`;
  if (requirement.type === "pass_assessment") return "Pass assessment";
  if (requirement.type === "submit_project") return "Submit project";
  if (requirement.type === "demonstrate_competency") return "Demonstrate competency";
  if (requirement.type === "earn_hours") return `Earn ${requirement.minimumHours} hours`;
  return requirement.id;
}

function courseTarget(courseId: string, courseMap: Map<string, CourseEntry>): RequirementTarget {
  const course = courseMap.get(courseId);
  return {
    id: courseId,
    label: course?.title ?? courseId,
    type: "course",
    course,
  };
}

function requirementTargets(requirement: LyciumRequirement, courseMap: Map<string, CourseEntry>): RequirementTarget[] {
  if (requirement.type === "complete_course") {
    return [courseTarget(requirement.courseId, courseMap)];
  }
  if (requirement.type === "complete_n_of_courses") {
    return requirement.courseIds.map((courseId) => courseTarget(courseId, courseMap));
  }
  if (requirement.type === "pass_assessment") {
    return [{ id: requirement.assessmentId, label: requirement.assessmentId, type: "assessment" }];
  }
  if (requirement.type === "submit_project") {
    return [{ id: requirement.projectId, label: requirement.projectId, type: "project" }];
  }
  if (requirement.type === "demonstrate_competency") {
    return [{ id: requirement.competencyId, label: requirement.competencyId, type: "competency" }];
  }
  if (requirement.type === "earn_hours") {
    return [{ id: requirement.id, label: `${requirement.minimumHours} hours`, type: "hours" }];
  }
  return requirement.requirements.flatMap((child) => requirementTargets(child, courseMap));
}

function targetTypeLabel(type: RequirementTarget["type"]): string {
  if (type === "course") return "Course";
  if (type === "assessment") return "Assessment";
  if (type === "project") return "Project";
  if (type === "competency") return "Competency";
  return "Hours";
}

function courseNeedsSourceInput(course: CourseEntry): boolean {
  const lifecycle = getCourseLifecycleSummary(course);
  const sourceSummary = sourceGapSummary(course);
  const hasCourseSources = Boolean(course.data.sourceIds?.length || course.data.sourceRecords?.length);
  return lifecycle.needsSourceInput || sourceSummary.blockingGaps.length > 0 || !hasCourseSources;
}

export default function CatalogRequirementRows({
  group,
  courseMap,
  progressCache,
  onOpenCourse,
  onOpenSourceGaps,
}: CatalogRequirementRowsProps) {
  const requirements = leafRequirements(group.requirements).filter((requirement) => requirement.required !== false);

  if (requirements.length === 0) {
    return null;
  }

  return (
    <section className="catalog-requirements" aria-label={`${group.displayName} requirements`}>
      <div className="catalog-requirements-header">
        <p>Cluster requirements</p>
        <strong>{group.completionRule.type.replace(/_/g, " ")}</strong>
      </div>
      <div className="catalog-requirements-list">
        {requirements.map((requirement) => {
          const progress = evaluateRequirementProgress(requirement, courseMap, progressCache);
          const targets = requirementTargets(requirement, courseMap);
          const needsEvidence = progress.evidenceIds.length === 0;
          const courseTargetsNeedingSources = targets.filter((target) => target.course && courseNeedsSourceInput(target.course));
          const hasSourceWarnings = needsEvidence || courseTargetsNeedingSources.length > 0;

          return (
            <article
              className={`catalog-requirement-row catalog-requirement-row--${progress.status}${hasSourceWarnings ? " catalog-requirement-row--source-gap" : ""}`}
              key={requirement.id}
            >
              <div className="catalog-requirement-main">
                <span className="catalog-requirement-status">{statusLabel(progress.status)}</span>
                <h3>{requirementTitle(requirement)}</h3>
                <p>
                  {progress.completedCount}/{progress.targetCount} complete
                  {progress.evidenceIds.length > 0 ? ` · ${progress.evidenceIds.length} evidence refs` : ""}
                </p>
                {hasSourceWarnings && (
                  <div className="catalog-requirement-source-warning" role="note">
                    <span>{needsEvidence ? "Needs source evidence" : "Needs stronger source coverage"}</span>
                    {courseTargetsNeedingSources.slice(0, 2).map((target) =>
                      target.course ? (
                        <button
                          key={target.id}
                          type="button"
                          onClick={() => onOpenSourceGaps(target.course as CourseEntry)}
                        >
                          Add source
                        </button>
                      ) : null,
                    )}
                  </div>
                )}
              </div>
              <div className="catalog-requirement-targets">
                {targets.map((target) =>
                  target.course ? (
                    <button
                      className="catalog-requirement-target"
                      key={`${target.type}-${target.id}`}
                      type="button"
                      onClick={() => target.course && onOpenCourse(target.course)}
                    >
                      <span>{targetTypeLabel(target.type)}</span>
                      {target.label}
                    </button>
                  ) : (
                    <span className="catalog-requirement-target catalog-requirement-target--static" key={`${target.type}-${target.id}`}>
                      <span>{targetTypeLabel(target.type)}</span>
                      {target.label}
                    </span>
                  ),
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

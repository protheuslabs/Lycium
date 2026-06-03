import type {
  LyciumCompletionRule,
  LyciumCurriculumBenchmark,
  LyciumDependencyEdge,
  LyciumProgram,
  LyciumRequirement,
  LyciumRequirementGroup,
} from "@lycium/contracts";
import type { CSSProperties } from "react";
import Button from "../Button/Button";
import type { CourseEntry } from "../../courseTypes";
import { getCourseProgress } from "../../utils/courseRouting";
import {
  estimateProgramTime,
  estimateRequirementGroupTime,
  estimateRequirementTime,
  formatTimeEstimate,
  timeEstimateSourceLabel,
} from "../../utils/curriculumTime";
import {
  allRequirementNodes,
  evaluateRequirementProgress,
  leafRequirements,
  requirementCourseIds,
  rollupProgramProgress,
  rollupRequirementGroupProgress,
  type RequirementProgressEvaluation,
  type RequirementProgressStatus,
} from "../../utils/programProgressRollup";
import "./ProgramView.css";

type SourceRecord = {
  id: string;
  title?: string;
  url?: string;
  publisher?: string;
};

type ProgramViewProps = {
  program: LyciumProgram;
  courses: CourseEntry[];
  benchmarks: LyciumCurriculumBenchmark[];
  sources: SourceRecord[];
  onOpenCourse: (course: CourseEntry) => void;
  onOpenCatalog: () => void;
};

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function statusLabel(status: RequirementProgressStatus): string {
  if (status === "complete") return "Complete";
  if (status === "in_progress") return "In progress";
  if (status === "blocked") return "Blocked";
  if (status === "missing") return "Missing course";
  return "Pending";
}

function requirementTypeLabel(requirement: LyciumRequirement): string {
  if (requirement.type === "complete_course") return "Course";
  if (requirement.type === "complete_n_of_courses") return `Choose ${requirement.count}`;
  if (requirement.type === "pass_assessment") return "Assessment";
  if (requirement.type === "submit_project") return "Project";
  if (requirement.type === "demonstrate_competency") return "Competency";
  if (requirement.type === "earn_hours") return "Hours";
  return requirement.operator === "n_of" ? `Set: ${requirement.count ?? 1} of ${requirement.requirements.length}` : `Set: ${requirement.operator}`;
}

function completionRuleLabel(rule: LyciumCompletionRule): string {
  if (rule.type === "complete_all") return "Complete all requirements";
  if (rule.type === "complete_n_of") return `Complete ${rule.count} requirements`;
  if (rule.type === "earn_minimum_hours") return `Earn ${rule.hours} learning hours`;
  if (rule.type === "pass_assessment") return `Pass assessment ${rule.assessmentId}${rule.minScore ? ` at ${rule.minScore}%+` : ""}`;
  if (rule.type === "submit_project") return `Submit project ${rule.projectId}`;
  return `Custom rule: ${rule.ruleId}`;
}

function requirementActionLabel(requirement: LyciumRequirement): string | null {
  if (requirement.type === "pass_assessment") return `Assessment: ${requirement.assessmentId} (${requirement.minScore}%+)`;
  if (requirement.type === "submit_project") return `Project: ${requirement.projectId}`;
  if (requirement.type === "demonstrate_competency") return `Competency: ${requirement.competencyId}`;
  if (requirement.type === "earn_hours") return `${requirement.minimumHours} required learning hours`;
  return null;
}

function dependencyBlockers(
  requirement: LyciumRequirement,
  dependencyEdges: LyciumDependencyEdge[],
  evaluationMap: Map<string, RequirementProgressEvaluation>,
  requirementTitleMap: Map<string, string>,
) {
  return dependencyEdges
    .filter((edge) => edge.toNodeId === requirement.id && edge.type === "required")
    .map((edge) => ({
      id: edge.fromNodeId,
      title: requirementTitleMap.get(edge.fromNodeId) ?? edge.fromNodeId,
      status: evaluationMap.get(edge.fromNodeId)?.status ?? "pending",
      rationale: edge.rationale,
    }))
    .filter((blocker) => blocker.status !== "complete");
}

function sourceLabel(sourceId: string, sourceMap: Map<string, SourceRecord>): string {
  const source = sourceMap.get(sourceId);
  return source?.title ?? sourceId;
}

function benchmarkTitle(benchmarkId: string, benchmarkMap: Map<string, LyciumCurriculumBenchmark>): string {
  return benchmarkMap.get(benchmarkId)?.title ?? benchmarkId;
}

function RequirementRow({
  requirement,
  courseMap,
  sourceMap,
  benchmarkMap,
  evaluationMap,
  requirementTitleMap,
  dependencyEdges,
  onOpenCourse,
  depth = 0,
}: {
  requirement: LyciumRequirement;
  courseMap: Map<string, CourseEntry>;
  sourceMap: Map<string, SourceRecord>;
  benchmarkMap: Map<string, LyciumCurriculumBenchmark>;
  evaluationMap: Map<string, RequirementProgressEvaluation>;
  requirementTitleMap: Map<string, string>;
  dependencyEdges: LyciumDependencyEdge[];
  onOpenCourse: (course: CourseEntry) => void;
  depth?: number;
}) {
  const baseEvaluation = evaluationMap.get(requirement.id) ?? evaluateRequirementProgress(requirement, courseMap);
  const blockers = dependencyBlockers(requirement, dependencyEdges, evaluationMap, requirementTitleMap);
  const evaluation =
    blockers.length > 0 && baseEvaluation.status !== "complete" && baseEvaluation.status !== "missing"
      ? { ...baseEvaluation, status: "blocked" as const }
      : baseEvaluation;
  const timeEstimate = estimateRequirementTime(requirement, courseMap);
  const courseIds = requirementCourseIds(requirement);
  const actionLabel = requirementActionLabel(requirement);
  const title = requirement.title ?? requirement.id;

  return (
    <div className={`program-requirement program-requirement-status-${evaluation.status}`} style={{ "--program-depth": depth } as CSSProperties}>
      <div className="program-requirement-main">
        <div>
          <div className="program-requirement-eyebrow">
            <span>{requirementTypeLabel(requirement)}</span>
            {requirement.importance && <span>{requirement.importance}</span>}
            <span>{formatTimeEstimate(timeEstimate)}</span>
            <span>{timeEstimateSourceLabel(timeEstimate)}</span>
          </div>
          <h4>{title}</h4>
          {requirement.origin?.notes && <p>{requirement.origin.notes}</p>}
        </div>
        <span className="program-status-pill">{statusLabel(evaluation.status)}</span>
      </div>

      {courseIds.length > 0 && (
        <div className="program-course-chip-row" aria-label={`Courses satisfying ${title}`}>
          {courseIds.map((courseId) => {
            const course = courseMap.get(courseId);
            const progress = course ? getCourseProgress(course) : null;
            return course ? (
              <button className="program-course-chip" key={courseId} type="button" onClick={() => onOpenCourse(course)}>
                <span>{course.title}</span>
                <small>{Math.round(progress?.percentage ?? 0)}% complete</small>
              </button>
            ) : (
              <span className="program-course-chip program-course-chip-missing" key={courseId}>
                <span>{courseId}</span>
                <small>course missing</small>
              </span>
            );
          })}
        </div>
      )}

      {actionLabel && (
        <div className="program-action-chip-row">
          <span className="program-action-chip">{actionLabel}</span>
          <span className="program-action-chip program-action-chip-placeholder">Evidence submission UI not connected yet</span>
        </div>
      )}

      {blockers.length > 0 && (
        <div className="program-blocker-row" aria-label={`${title} blockers`}>
          <strong>Required first:</strong>
          {blockers.map((blocker) => (
            <span key={blocker.id} title={blocker.rationale}>
              {blocker.title}
            </span>
          ))}
        </div>
      )}

      <div className="program-evidence-row">
        {evaluation.evidenceIds.length > 0 ? (
          evaluation.evidenceIds.slice(0, 4).map((sourceId) => (
            <span className="program-evidence-chip" key={sourceId} title={sourceLabel(sourceId, sourceMap)}>
              {sourceLabel(sourceId, sourceMap)}
            </span>
          ))
        ) : (
          <span className="program-evidence-chip program-evidence-chip-warning">No source evidence yet</span>
        )}
        {evaluation.benchmarkIds.map((benchmarkId) => (
          <span className="program-evidence-chip program-evidence-chip-benchmark" key={benchmarkId} title={benchmarkTitle(benchmarkId, benchmarkMap)}>
            Benchmark
          </span>
        ))}
      </div>

      {requirement.type === "requirement_set" && (
        <div className="program-nested-requirements">
          {requirement.requirements.map((nested) => (
            <RequirementRow
              key={nested.id}
              requirement={nested}
              courseMap={courseMap}
                  sourceMap={sourceMap}
                  benchmarkMap={benchmarkMap}
                  evaluationMap={evaluationMap}
                  requirementTitleMap={requirementTitleMap}
                  dependencyEdges={dependencyEdges}
                  onOpenCourse={onOpenCourse}
                  depth={depth + 1}
                />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProgramView({ program, courses, benchmarks, sources, onOpenCourse, onOpenCatalog }: ProgramViewProps) {
  const courseMap = new Map(courses.map((course) => [course.key, course]));
  const programProgress = rollupProgramProgress(program, courseMap);
  const programTimeEstimate = estimateProgramTime(program, courses);
  const sourceMap = new Map(sources.map((source) => [source.id, source]));
  const benchmarkMap = new Map(benchmarks.map((benchmark) => [benchmark.id, benchmark]));
  const dependencyEdges = program.dependencyGraph?.edges ?? [];
  const requirementNodes = [
    ...allRequirementNodes(program.entryRequirements),
    ...program.requirementGroups.flatMap((group) => allRequirementNodes(group.requirements)),
  ];
  const requirementTitleMap = new Map(requirementNodes.map((requirement) => [requirement.id, requirement.title ?? requirement.id]));
  const evaluationMap = new Map(requirementNodes.map((requirement) => [requirement.id, evaluateRequirementProgress(requirement, courseMap)]));
  const allRequirements = program.requirementGroups.flatMap((group) => leafRequirements(group.requirements));
  const requiredRequirements = allRequirements.filter((requirement) => requirement.required !== false);
  const evaluations = requiredRequirements.map((requirement) => evaluateRequirement(requirement, courseMap));
  const missingCourseRefs = unique(evaluations.flatMap((evaluation) => evaluation.missingCourseIds));
  const sourceCoveredCount = evaluations.filter((evaluation) => evaluation.evidenceIds.length > 0).length;
  const assessmentOrProjectCount = requiredRequirements.filter((requirement) => requirement.type === "pass_assessment" || requirement.type === "submit_project").length;
  const capstoneRequirements = requiredRequirements.filter((requirement) => requirement.type === "submit_project");
  const completePercentage = Math.round(programProgress.percentage);
  const activePercentage = Math.round(programProgress.viewedPercentage);

  return (
    <main className="program-view-shell">
      <section className="program-hero-panel">
        <Button variant="nav" className="program-back-button" onClick={onOpenCatalog}>
          ← Catalog
        </Button>
        <div>
          <p className="program-kicker">Program</p>
          <h1>{program.title}</h1>
          <p className="program-description">{program.description}</p>
          <div className="program-meta-row">
            <span>{program.programType.replace(/_/g, " ")}</span>
            <span>{program.level}</span>
            <span>{formatTimeEstimate(programTimeEstimate)}</span>
            <span>{timeEstimateSourceLabel(programTimeEstimate)}</span>
            <span>{program.reviewStatus}</span>
          </div>
        </div>
        <div className="program-progress-card" aria-label="Program progress">
          <strong>{completePercentage}%</strong>
          <span>mastery progress</span>
          <div className="program-progress-bar">
            <div className="program-progress-viewed" style={{ width: `${activePercentage}%` }} />
            <div className="program-progress-complete" style={{ width: `${completePercentage}%` }} />
          </div>
          <small>{programProgress.completed} of {programProgress.total} clusters complete</small>
        </div>
      </section>

      <section className="program-quality-panel" aria-label="Program quality and gaps">
        <div>
          <span className="program-quality-number">{sourceCoveredCount}/{requiredRequirements.length}</span>
          <span>requirements with source or benchmark evidence</span>
        </div>
        <div>
          <span className="program-quality-number">{missingCourseRefs.length}</span>
          <span>missing catalog course references</span>
        </div>
        <div>
          <span className="program-quality-number">{assessmentOrProjectCount}</span>
          <span>assessment or portfolio gates</span>
        </div>
        <div>
          <span className="program-quality-number">{benchmarks.length}</span>
          <span>benchmark records attached</span>
        </div>
      </section>

      <section className="program-pathway-panel" aria-label="Program outcome and policies">
        <article>
          <p className="program-kicker">Target outcome</p>
          <h2>{program.targetOutcome}</h2>
          <p>{program.learningOutcomes.map((outcome) => outcome.statement).join(" ")}</p>
        </article>
        <article>
          <p className="program-kicker">Entry requirements</p>
          {program.entryRequirements.length > 0 ? (
            <ul>
              {program.entryRequirements.map((requirement) => (
                <li key={requirement.id}>{requirement.title ?? requirement.id}</li>
              ))}
            </ul>
          ) : (
            <p>No formal entry requirements recorded.</p>
          )}
        </article>
        <article>
          <p className="program-kicker">Mastery policy</p>
          <ul>
            <li>{program.masteryPolicy.minimumMasteryPercent ?? 100}% mastery target</li>
            {program.masteryPolicy.minimumAssessmentPercent && <li>{program.masteryPolicy.minimumAssessmentPercent}% assessment target</li>}
            <li>Capstone {program.masteryPolicy.requiresCapstone ? "required" : "not required"}</li>
            {program.masteryPolicy.remediationPolicy && <li>Remediation: {program.masteryPolicy.remediationPolicy}</li>}
          </ul>
        </article>
        <article>
          <p className="program-kicker">Credential evidence</p>
          <ul>
            <li>{program.credentialPolicy?.title ?? "No credential title recorded"}</li>
            <li>{program.credentialPolicy?.credentialType?.replace(/_/g, " ") ?? "No credential type recorded"}</li>
            <li>Human review {program.credentialPolicy?.requiresHumanReview ? "required" : "not required"}</li>
          </ul>
        </article>
      </section>

      {capstoneRequirements.length > 0 && (
        <section className="program-capstone-panel" aria-label="Program capstone evidence">
          <div>
            <p className="program-kicker">Portfolio evidence</p>
            <h2>Capstone and proof of work</h2>
            <p>Career-path programs should end in reviewable artifacts, not only course completion.</p>
          </div>
          <div className="program-capstone-list">
            {capstoneRequirements.map((requirement) => (
              <span className="program-action-chip" key={requirement.id}>
                {requirement.title ?? requirement.projectId}
              </span>
            ))}
          </div>
        </section>
      )}

      {benchmarks.length > 0 && (
        <section className="program-benchmark-panel">
          <h2>Benchmark context</h2>
          <div className="program-benchmark-grid">
            {benchmarks.map((benchmark) => (
              <article className="program-benchmark-card" key={benchmark.id}>
                <h3>{benchmark.title}</h3>
                <p>{benchmark.notes}</p>
                <div className="program-benchmark-topics">
                  {benchmark.topics.slice(0, 6).map((topic) => <span key={topic}>{topic}</span>)}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="program-cluster-list" aria-label="Program requirement groups">
        {program.requirementGroups.map((group) => {
          const progress = rollupRequirementGroupProgress(group, courseMap);
          const groupTimeEstimate = estimateRequirementGroupTime(group, courseMap);
          return (
            <article className="program-cluster-card" key={group.id}>
              <header className="program-cluster-header">
                <div>
                  <p className="program-kicker">{group.groupKind.replace(/_/g, " ")}</p>
                  <h2>{group.displayName}</h2>
                  <p>{group.purpose}</p>
                  <p className="program-completion-rule">{completionRuleLabel(group.completionRule)}</p>
                  {group.prerequisites && group.prerequisites.length > 0 && (
                    <div className="program-blocker-row" aria-label={`${group.displayName} prerequisites`}>
                      <strong>Prerequisites:</strong>
                      {group.prerequisites.map((prerequisite) => {
                        const nodeId = typeof prerequisite === "string" ? prerequisite : prerequisite.nodeId;
                        return <span key={nodeId}>{requirementTitleMap.get(nodeId) ?? nodeId}</span>;
                      })}
                    </div>
                  )}
                </div>
                <div className="program-cluster-progress">
                  <strong>{progress.percentage}%</strong>
                  <span>{progress.completed}/{progress.total}</span>
                  <span>{formatTimeEstimate(groupTimeEstimate)}</span>
                  <span>{timeEstimateSourceLabel(groupTimeEstimate)}</span>
                  <div className="program-progress-bar">
                    <div className="program-progress-viewed" style={{ width: `${progress.viewedPercentage}%` }} />
                    <div className="program-progress-complete" style={{ width: `${progress.percentage}%` }} />
                  </div>
                </div>
              </header>
              <div className="program-requirement-list">
                {group.requirements.map((requirement) => (
                  <RequirementRow
                    key={requirement.id}
                    requirement={requirement}
                    courseMap={courseMap}
                  sourceMap={sourceMap}
                  benchmarkMap={benchmarkMap}
                  evaluationMap={evaluationMap}
                  requirementTitleMap={requirementTitleMap}
                  dependencyEdges={dependencyEdges}
                  onOpenCourse={onOpenCourse}
                />
              ))}
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}

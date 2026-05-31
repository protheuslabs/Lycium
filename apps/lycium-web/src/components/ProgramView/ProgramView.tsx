import type {
  LyciumCurriculumBenchmark,
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
import "./ProgramView.css";

type SourceRecord = {
  id: string;
  title?: string;
  url?: string;
  publisher?: string;
};

type RequirementStatus = "complete" | "in_progress" | "pending" | "missing";

type RequirementEvaluation = {
  status: RequirementStatus;
  completedCount: number;
  targetCount: number;
  connectedCourseIds: string[];
  missingCourseIds: string[];
  evidenceIds: string[];
  benchmarkIds: string[];
};

type ProgramViewProps = {
  program: LyciumProgram;
  courses: CourseEntry[];
  benchmarks: LyciumCurriculumBenchmark[];
  sources: SourceRecord[];
  onOpenCourse: (course: CourseEntry) => void;
  onOpenCatalog: () => void;
};

function leafRequirements(requirements: LyciumRequirement[]): LyciumRequirement[] {
  return requirements.flatMap((requirement) =>
    requirement.type === "requirement_set" ? leafRequirements(requirement.requirements) : [requirement],
  );
}

function courseIdsForRequirement(requirement: LyciumRequirement): string[] {
  if (requirement.type === "complete_course") return [requirement.courseId];
  if (requirement.type === "complete_n_of_courses") return requirement.courseIds;
  if (requirement.type === "requirement_set") return requirement.requirements.flatMap(courseIdsForRequirement);
  return [];
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function sourceIdsForCourse(course: CourseEntry | undefined): string[] {
  if (!course) return [];
  const topLevel = Array.isArray(course.data.sourceIds) ? course.data.sourceIds : [];
  const courseLevel = Array.isArray(course.data.sourceRecords) ? course.data.sourceRecords.map((source) => source.id) : [];
  return unique([...topLevel, ...courseLevel]);
}

function evaluateRequirement(requirement: LyciumRequirement, courseMap: Map<string, CourseEntry>): RequirementEvaluation {
  if (requirement.type === "requirement_set") {
    const nested = requirement.requirements.map((child) => evaluateRequirement(child, courseMap));
    const completedCount = nested.filter((row) => row.status === "complete").length;
    const targetCount = requirement.operator === "n_of" ? requirement.count ?? 1 : requirement.operator === "any" ? 1 : nested.length;
    const hasMissing = nested.some((row) => row.status === "missing");
    const hasProgress = nested.some((row) => row.status === "complete" || row.status === "in_progress");
    return {
      status: completedCount >= targetCount ? "complete" : hasMissing ? "missing" : hasProgress ? "in_progress" : "pending",
      completedCount,
      targetCount,
      connectedCourseIds: unique(nested.flatMap((row) => row.connectedCourseIds)),
      missingCourseIds: unique(nested.flatMap((row) => row.missingCourseIds)),
      evidenceIds: unique([...(requirement.origin?.evidenceRefs ?? []), ...nested.flatMap((row) => row.evidenceIds)]),
      benchmarkIds: unique([...(requirement.origin?.benchmarkIds ?? []), ...nested.flatMap((row) => row.benchmarkIds)]),
    };
  }

  const originEvidence = requirement.origin?.evidenceRefs ?? [];
  const benchmarkIds = requirement.origin?.benchmarkIds ?? [];

  if (requirement.type === "complete_course" || requirement.type === "complete_n_of_courses") {
    const courseIds = courseIdsForRequirement(requirement);
    const targetCount = requirement.type === "complete_n_of_courses" ? requirement.count : courseIds.length;
    const connectedCourses = courseIds.map((courseId) => courseMap.get(courseId)).filter((course): course is CourseEntry => Boolean(course));
    const missingCourseIds = courseIds.filter((courseId) => !courseMap.has(courseId));
    const completedCount = connectedCourses.filter((course) => getCourseProgress(course).percentage >= 100).length;
    const viewedCount = connectedCourses.filter((course) => getCourseProgress(course).viewed > 0).length;
    const evidenceIds = unique([...originEvidence, ...connectedCourses.flatMap(sourceIdsForCourse)]);

    return {
      status:
        missingCourseIds.length > 0
          ? "missing"
          : completedCount >= targetCount
            ? "complete"
            : completedCount > 0 || viewedCount > 0
              ? "in_progress"
              : "pending",
      completedCount,
      targetCount,
      connectedCourseIds: connectedCourses.map((course) => course.key),
      missingCourseIds,
      evidenceIds,
      benchmarkIds,
    };
  }

  return {
    status: "pending",
    completedCount: 0,
    targetCount: 1,
    connectedCourseIds: [],
    missingCourseIds: [],
    evidenceIds: unique(originEvidence),
    benchmarkIds: unique(benchmarkIds),
  };
}

function statusLabel(status: RequirementStatus): string {
  if (status === "complete") return "Complete";
  if (status === "in_progress") return "In progress";
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

function groupProgress(group: LyciumRequirementGroup, courseMap: Map<string, CourseEntry>) {
  const requirements = leafRequirements(group.requirements).filter((requirement) => requirement.required !== false);
  const total = Math.max(1, requirements.length);
  const completed = requirements.filter((requirement) => evaluateRequirement(requirement, courseMap).status === "complete").length;
  const active = requirements.filter((requirement) => ["complete", "in_progress"].includes(evaluateRequirement(requirement, courseMap).status)).length;

  return {
    completed,
    active,
    total,
    percentage: Math.round((completed / total) * 100),
    viewedPercentage: Math.round((active / total) * 100),
  };
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
  onOpenCourse,
  depth = 0,
}: {
  requirement: LyciumRequirement;
  courseMap: Map<string, CourseEntry>;
  sourceMap: Map<string, SourceRecord>;
  benchmarkMap: Map<string, LyciumCurriculumBenchmark>;
  onOpenCourse: (course: CourseEntry) => void;
  depth?: number;
}) {
  const evaluation = evaluateRequirement(requirement, courseMap);
  const timeEstimate = estimateRequirementTime(requirement, courseMap);
  const courseIds = courseIdsForRequirement(requirement);
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
  const programTimeEstimate = estimateProgramTime(program, courses);
  const sourceMap = new Map(sources.map((source) => [source.id, source]));
  const benchmarkMap = new Map(benchmarks.map((benchmark) => [benchmark.id, benchmark]));
  const allRequirements = program.requirementGroups.flatMap((group) => leafRequirements(group.requirements));
  const requiredRequirements = allRequirements.filter((requirement) => requirement.required !== false);
  const evaluations = requiredRequirements.map((requirement) => evaluateRequirement(requirement, courseMap));
  const completed = evaluations.filter((evaluation) => evaluation.status === "complete").length;
  const active = evaluations.filter((evaluation) => evaluation.status === "complete" || evaluation.status === "in_progress").length;
  const missingCourseRefs = unique(evaluations.flatMap((evaluation) => evaluation.missingCourseIds));
  const sourceCoveredCount = evaluations.filter((evaluation) => evaluation.evidenceIds.length > 0).length;
  const assessmentOrProjectCount = requiredRequirements.filter((requirement) => requirement.type === "pass_assessment" || requirement.type === "submit_project").length;
  const completePercentage = Math.round((completed / Math.max(1, requiredRequirements.length)) * 100);
  const activePercentage = Math.round((active / Math.max(1, requiredRequirements.length)) * 100);

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
          <small>{completed} of {requiredRequirements.length} required requirements complete</small>
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
          const progress = groupProgress(group, courseMap);
          const groupTimeEstimate = estimateRequirementGroupTime(group, courseMap);
          return (
            <article className="program-cluster-card" key={group.id}>
              <header className="program-cluster-header">
                <div>
                  <p className="program-kicker">{group.groupKind.replace(/_/g, " ")}</p>
                  <h2>{group.displayName}</h2>
                  <p>{group.purpose}</p>
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

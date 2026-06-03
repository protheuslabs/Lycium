import type {
  LyciumCurriculumBenchmark,
  LyciumDependencyEdge,
  LyciumPortfolioArtifactRequirement,
  LyciumRequirement,
} from "@lycium/contracts";
import type { RequirementProgressEvaluation } from "../../utils/programProgressRollup";

type SourceRecord = {
  id: string;
  title?: string;
  url?: string;
  publisher?: string;
};

type RequirementBlocker = {
  id: string;
  title: string;
  status: string;
  rationale?: string;
};

type RequirementDetailPanelProps = {
  requirement: LyciumRequirement;
  evaluation: RequirementProgressEvaluation;
  blockers: RequirementBlocker[];
  dependencyEdges: LyciumDependencyEdge[];
  sourceMap: Map<string, SourceRecord>;
  benchmarkMap: Map<string, LyciumCurriculumBenchmark>;
  portfolioArtifact?: LyciumPortfolioArtifactRequirement | null;
  requirementTitleMap: Map<string, string>;
};

function evidenceLabel(sourceId: string, sourceMap: Map<string, SourceRecord>): string {
  const source = sourceMap.get(sourceId);
  return source?.title ?? sourceId;
}

function benchmarkLabel(benchmarkId: string, benchmarkMap: Map<string, LyciumCurriculumBenchmark>): string {
  return benchmarkMap.get(benchmarkId)?.title ?? benchmarkId;
}

function originLabel(requirement: LyciumRequirement): string {
  return requirement.origin?.originType?.replace(/_/g, " ") ?? "No origin recorded";
}

function originConfidence(requirement: LyciumRequirement): string {
  const score = requirement.origin?.score ?? requirement.origin?.frequency ?? requirement.origin?.sourceConfidence;
  return typeof score === "number" ? `${Math.round(score * 100)}% confidence` : "No confidence score";
}

export default function RequirementDetailPanel({
  requirement,
  evaluation,
  blockers,
  dependencyEdges,
  sourceMap,
  benchmarkMap,
  portfolioArtifact,
  requirementTitleMap,
}: RequirementDetailPanelProps) {
  const downstreamEdges = dependencyEdges.filter((edge) => edge.fromNodeId === requirement.id);

  return (
    <details className="program-requirement-detail">
      <summary>
        <span>Requirement details</span>
        <strong>
          {evaluation.completedCount}/{evaluation.targetCount} satisfied
        </strong>
      </summary>
      <div className="program-requirement-detail-grid">
        <article>
          <h5>Progress rule</h5>
          <p>Status: {evaluation.status.replace(/_/g, " ")}</p>
          <p>{evaluation.connectedCourseIds.length} linked course references</p>
          {evaluation.missingCourseIds.length > 0 && <p>{evaluation.missingCourseIds.length} missing course references</p>}
        </article>
        <article>
          <h5>Why it exists</h5>
          <p>{originLabel(requirement)}</p>
          <p>{originConfidence(requirement)}</p>
          {requirement.origin?.frequency && <p>Appears in {Math.round(requirement.origin.frequency * 100)}% of benchmark signal.</p>}
        </article>
        <article>
          <h5>Evidence</h5>
          <div className="program-requirement-detail-chip-row">
            {evaluation.evidenceIds.length > 0 ? (
              evaluation.evidenceIds.map((sourceId) => <span key={sourceId}>{evidenceLabel(sourceId, sourceMap)}</span>)
            ) : (
              <span className="program-requirement-detail-warning">Needs source evidence</span>
            )}
            {evaluation.benchmarkIds.map((benchmarkId) => <span key={benchmarkId}>{benchmarkLabel(benchmarkId, benchmarkMap)}</span>)}
          </div>
        </article>
        {portfolioArtifact && (
          <article>
            <h5>Portfolio artifact</h5>
            <p>{portfolioArtifact.artifactType.replace(/_/g, " ")}</p>
            {portfolioArtifact.rubricId && <p>Rubric: {portfolioArtifact.rubricId}</p>}
            <div className="program-requirement-detail-chip-row">
              {portfolioArtifact.requiredEvidence.map((item) => <span key={item}>{item}</span>)}
            </div>
          </article>
        )}
        <article>
          <h5>Dependencies</h5>
          <div className="program-requirement-detail-chip-row">
            {blockers.length > 0
              ? blockers.map((blocker) => <span key={blocker.id}>{blocker.title}</span>)
              : <span>No active blockers</span>}
            {downstreamEdges.map((edge) => (
              <span key={`${edge.fromNodeId}-${edge.toNodeId}`}>
                Unlocks {requirementTitleMap.get(edge.toNodeId) ?? edge.toNodeId}
              </span>
            ))}
          </div>
        </article>
      </div>
    </details>
  );
}

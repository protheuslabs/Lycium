import type {
  LyciumEvidenceArtifactSubmission,
  LyciumPortfolioArtifactRequirement,
  LyciumRequirement,
} from "@lycium/contracts";
import { useState, type FormEvent } from "react";
import type { ProgramArtifactDraft } from "../../hooks/useProgramArtifacts";

type ProgramArtifactSubmissionProps = {
  programId: string;
  requirement: Extract<LyciumRequirement, { type: "submit_project" }>;
  title: string;
  portfolioArtifact?: LyciumPortfolioArtifactRequirement | null;
  artifacts: LyciumEvidenceArtifactSubmission[];
  onSubmitArtifact: (artifact: ProgramArtifactDraft) => void;
};

export function artifactSubmitted(artifact: LyciumEvidenceArtifactSubmission): boolean {
  return artifact.status === "submitted" || artifact.status === "accepted";
}

export function artifactsForRequirement(
  requirement: LyciumRequirement,
  artifacts: LyciumEvidenceArtifactSubmission[],
): LyciumEvidenceArtifactSubmission[] {
  return artifacts.filter((artifact) => {
    if (artifact.requirementId === requirement.id) return true;
    return requirement.type === "submit_project" && artifact.projectId === requirement.projectId;
  });
}

export default function ProgramArtifactSubmission({
  programId,
  requirement,
  title,
  portfolioArtifact,
  artifacts,
  onSubmitArtifact,
}: ProgramArtifactSubmissionProps) {
  const [artifactFormOpen, setArtifactFormOpen] = useState(false);
  const [artifactUrl, setArtifactUrl] = useState("");
  const [artifactNotes, setArtifactNotes] = useState("");

  function handleArtifactSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmitArtifact({
      programId,
      requirementId: requirement.id,
      projectId: requirement.projectId,
      artifactRequirementId: portfolioArtifact?.id,
      title: portfolioArtifact?.title ?? title,
      artifactType: portfolioArtifact?.artifactType ?? "project",
      url: artifactUrl.trim() || undefined,
      notes: artifactNotes.trim() || undefined,
      submittedEvidence: portfolioArtifact?.requiredEvidence ?? [],
    });
    setArtifactUrl("");
    setArtifactNotes("");
    setArtifactFormOpen(false);
  }

  return (
    <div className="program-artifact-submission">
      <button className="program-artifact-toggle" type="button" onClick={() => setArtifactFormOpen((open) => !open)}>
        {artifactFormOpen ? "Close evidence" : "Submit evidence"}
      </button>

      {artifactFormOpen && (
        <form className="program-artifact-form" onSubmit={handleArtifactSubmit}>
          <label>
            Artifact link
            <input
              type="url"
              value={artifactUrl}
              onChange={(event) => setArtifactUrl(event.target.value)}
              placeholder="https://github.com/example/project"
            />
          </label>
          <label>
            Notes
            <textarea
              value={artifactNotes}
              onChange={(event) => setArtifactNotes(event.target.value)}
              placeholder="Explain what this artifact demonstrates."
              rows={3}
            />
          </label>
          {portfolioArtifact?.requiredEvidence.length ? (
            <div className="program-artifact-evidence-list">
              {portfolioArtifact.requiredEvidence.map((item) => <span key={item}>{item}</span>)}
            </div>
          ) : null}
          <button className="program-artifact-submit" type="submit">Save evidence</button>
        </form>
      )}

      {artifacts.length > 0 && (
        <div className="program-submitted-artifacts" aria-label={`${title} submitted evidence`}>
          {artifacts.map((artifact) => (
            <a key={artifact.id} href={artifact.url || undefined} target="_blank" rel="noreferrer">
              <strong>{artifact.title}</strong>
              <span>{artifact.status.replace(/_/g, " ")}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

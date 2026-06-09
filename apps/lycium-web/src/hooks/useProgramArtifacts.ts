import type { LyciumEvidenceArtifactSubmission } from "@lycium/contracts";
import { useCallback, useState } from "react";
import { browserStorage } from "../runtime/appRuntime";

export type ProgramArtifactDraft = Omit<LyciumEvidenceArtifactSubmission, "id" | "createdAt" | "updatedAt" | "status"> & {
  status?: LyciumEvidenceArtifactSubmission["status"];
};

function createArtifactId(draft: ProgramArtifactDraft): string {
  const stamp = Date.now().toString(36);
  const base = `${draft.programId}-${draft.requirementId}`.replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
  return `${base}-artifact-${stamp}`;
}

export function useProgramArtifacts() {
  const [programArtifacts, setProgramArtifacts] = useState<LyciumEvidenceArtifactSubmission[]>(() =>
    browserStorage.readProgramArtifacts(),
  );

  const submitProgramArtifact = useCallback((draft: ProgramArtifactDraft) => {
    const now = new Date().toISOString();
    const artifact: LyciumEvidenceArtifactSubmission = {
      ...draft,
      id: createArtifactId(draft),
      status: draft.status ?? "submitted",
      createdAt: now,
      updatedAt: now,
    };

    setProgramArtifacts((current) => {
      const next = [artifact, ...current.filter((existing) => existing.id !== artifact.id)];
      browserStorage.writeProgramArtifacts(next);
      return next;
    });
  }, []);

  return { programArtifacts, submitProgramArtifact };
}

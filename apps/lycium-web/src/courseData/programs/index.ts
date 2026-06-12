import type { LyciumEvidenceArtifactSubmission, LyciumProgram } from "@lycium/contracts";

export const existingLocalCourseIds: string[] = [];
export const localPrograms: LyciumProgram[] = [];
export const programBenchmarks: Record<string, []> = {};
export const localPortfolioArtifacts: LyciumEvidenceArtifactSubmission[] = [];
export const localPortfolioArtifactIds: string[] = [];
export const localPortfolioArtifactMap: Record<string, LyciumEvidenceArtifactSubmission> = {};
export const softwareEngineeringCourseWrapperIds: string[] = [];
export const softwareEngineeringCourseWrappers = [];

export function validateLocalPrograms() {
  return [];
}

export default localPrograms;

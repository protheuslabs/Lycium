import { validateLyciumProgram } from "@lycium/contracts";
import fullStackEngineerBenchmarks from "./fullStackEngineerBenchmarks";
import fullStackEngineerProgram from "./fullStackEngineerProgram";
import { localPortfolioArtifactIds, localPortfolioArtifactMap, localPortfolioArtifacts } from "./portfolioArtifacts";
import softwareEngineeringProgramBenchmarks from "./softwareEngineeringProgramBenchmarks";
import softwareEngineeringProgram from "./softwareEngineeringProgram";
import { softwareEngineeringCourseWrapperIds, softwareEngineeringCourseWrappers } from "./softwareEngineeringCourseWrappers";

export const existingLocalCourseIds = [
  "local-ai",
  "local-web",
  "local-python",
  "local-mlsys",
  "local-software-architecture",
];

export const localPrograms = [softwareEngineeringProgram, fullStackEngineerProgram];
export const programBenchmarks = {
  [softwareEngineeringProgram.id]: softwareEngineeringProgramBenchmarks,
  [fullStackEngineerProgram.id]: fullStackEngineerBenchmarks,
};
export { localPortfolioArtifactIds, localPortfolioArtifactMap, localPortfolioArtifacts };
export { softwareEngineeringCourseWrapperIds, softwareEngineeringCourseWrappers };

export function validateLocalPrograms() {
  const courseIds = [...existingLocalCourseIds, ...softwareEngineeringCourseWrapperIds];

  return localPrograms.map((program) => ({
    programId: program.id,
    ...validateLyciumProgram(program, {
      courseIds,
      assessmentIds: [
        "full-stack-readiness-review",
        "se-developer-workflow-readiness",
        "se-cs-core-checkpoint",
        "se-software-engineering-design-review",
        "se-application-integration-review",
        "se-data-model-review",
        "se-operations-readiness-check",
        "se-specialization-readiness-review",
        "se-capstone-proposal-review",
        "se-professional-readiness-review",
      ],
      projectIds: [
        ...localPortfolioArtifactIds,
      ],
      competencyIds: ["basic-computer-literacy", "high-school-algebra-and-computer-literacy"],
    }),
  }));
}

export default localPrograms;

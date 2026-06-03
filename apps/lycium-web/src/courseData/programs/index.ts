import { validateLyciumProgram } from "@lycium/contracts";
import fullStackEngineerBenchmarks from "./fullStackEngineerBenchmarks";
import fullStackEngineerProgram from "./fullStackEngineerProgram";
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
        "full-stack-portfolio-capstone",
        "se-architecture-quality-evidence-package",
        "se-service-backed-application-slice",
        "se-deployed-service-evidence",
        "se-professional-practice-dossier",
        "se-specialization-evidence-artifact",
        "se-capstone-portfolio-project",
      ],
      competencyIds: ["basic-computer-literacy", "high-school-algebra-and-computer-literacy"],
    }),
  }));
}

export default localPrograms;

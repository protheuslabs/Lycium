import { validateLyciumProgram } from "@lycium/contracts";
import fullStackEngineerBenchmarks from "./fullStackEngineerBenchmarks";
import fullStackEngineerProgram from "./fullStackEngineerProgram";
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
  [fullStackEngineerProgram.id]: fullStackEngineerBenchmarks,
};
export { softwareEngineeringCourseWrapperIds, softwareEngineeringCourseWrappers };

export function validateLocalPrograms() {
  const courseIds = [...existingLocalCourseIds, ...softwareEngineeringCourseWrapperIds];

  return localPrograms.map((program) => ({
    programId: program.id,
    ...validateLyciumProgram(program, {
      courseIds,
      assessmentIds: ["full-stack-readiness-review", "se-professional-readiness-review"],
      projectIds: ["full-stack-portfolio-capstone", "se-capstone-portfolio-project"],
      competencyIds: ["basic-computer-literacy", "high-school-algebra-and-computer-literacy"],
    }),
  }));
}

export default localPrograms;

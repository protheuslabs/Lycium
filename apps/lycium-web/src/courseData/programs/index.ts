import { validateLyciumProgram } from "@lycium/contracts";
import { localCourses } from "../localCourses";
import fullStackEngineerProgram from "./fullStackEngineerProgram";

export const localPrograms = [fullStackEngineerProgram];

export function validateLocalPrograms() {
  const courseIds = localCourses.map((course) => course.key);

  return localPrograms.map((program) => ({
    programId: program.id,
    ...validateLyciumProgram(program, {
      courseIds,
      assessmentIds: ["full-stack-readiness-review"],
      projectIds: ["full-stack-portfolio-capstone"],
      competencyIds: ["basic-computer-literacy"],
    }),
  }));
}

export default localPrograms;

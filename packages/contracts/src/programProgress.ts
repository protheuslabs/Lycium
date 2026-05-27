import type { LyciumProgram, LyciumProgramProgressInput, LyciumProgramProgressState, LyciumRequirement } from "./programTypes";

function toSet(values?: Iterable<string>): Set<string> {
  return values ? new Set(values) : new Set();
}

function flattenRequirements(requirements: LyciumRequirement[]): LyciumRequirement[] {
  return requirements.flatMap((requirement) =>
    requirement.type === "requirement_set" ? [requirement, ...flattenRequirements(requirement.requirements)] : [requirement],
  );
}

function requirementSatisfied(requirement: LyciumRequirement, input: Required<LyciumProgramProgressInput>): boolean {
  if (requirement.type === "complete_course") {
    return toSet(input.completedCourseIds).has(requirement.courseId);
  }
  if (requirement.type === "complete_n_of_courses") {
    return requirement.courseIds.filter((courseId) => toSet(input.completedCourseIds).has(courseId)).length >= requirement.count;
  }
  if (requirement.type === "pass_assessment") {
    return toSet(input.passedAssessmentIds).has(requirement.assessmentId);
  }
  if (requirement.type === "submit_project") {
    return toSet(input.submittedProjectIds).has(requirement.projectId);
  }
  if (requirement.type === "demonstrate_competency") {
    return toSet(input.masteredCompetencyIds).has(requirement.competencyId);
  }
  if (requirement.type === "earn_hours") {
    return input.earnedHours >= requirement.minimumHours;
  }

  const nestedSatisfied = requirement.requirements.filter((nested) => requirementSatisfied(nested, input)).length;
  if (requirement.operator === "all") return nestedSatisfied === requirement.requirements.length;
  if (requirement.operator === "any") return nestedSatisfied > 0;
  return nestedSatisfied >= (requirement.count ?? 1);
}

export function calculateProgramProgress(
  program: LyciumProgram,
  progressInput: LyciumProgramProgressInput = {},
): LyciumProgramProgressState {
  const input: Required<LyciumProgramProgressInput> = {
    viewedRequirementIds: progressInput.viewedRequirementIds ?? [],
    completedCourseIds: progressInput.completedCourseIds ?? [],
    passedAssessmentIds: progressInput.passedAssessmentIds ?? [],
    submittedProjectIds: progressInput.submittedProjectIds ?? [],
    masteredCompetencyIds: progressInput.masteredCompetencyIds ?? [],
    earnedHours: progressInput.earnedHours ?? 0,
  };
  const requirements = program.requirementGroups.flatMap((group) => flattenRequirements(group.requirements));
  const requiredRequirements = requirements.filter((requirement) => requirement.required !== false);
  const viewedIds = toSet(input.viewedRequirementIds);
  const viewedCount = requiredRequirements.filter((requirement) => viewedIds.has(requirement.id)).length;
  const completedCount = requiredRequirements.filter((requirement) => requirementSatisfied(requirement, input)).length;
  const assessmentRequirements = requiredRequirements.filter((requirement) => requirement.type === "pass_assessment");
  const passedAssessments = assessmentRequirements.filter((requirement) => requirementSatisfied(requirement, input)).length;
  const projectRequirements = requiredRequirements.filter((requirement) => requirement.type === "submit_project");
  const submittedProjects = projectRequirements.filter((requirement) => requirementSatisfied(requirement, input)).length;
  const denominator = Math.max(1, requiredRequirements.length);
  const masteryPercent = Math.round((completedCount / denominator) * 100);
  const status =
    masteryPercent >= (program.masteryPolicy.minimumMasteryPercent ?? 100)
      ? "mastered"
      : viewedCount > 0 || completedCount > 0
        ? "in_progress"
        : "not_started";

  return {
    viewedPercent: Math.round((viewedCount / denominator) * 100),
    exercisePercent: masteryPercent,
    assessmentPercent: assessmentRequirements.length ? Math.round((passedAssessments / assessmentRequirements.length) * 100) : masteryPercent,
    masteryPercent,
    projectArtifacts: submittedProjects,
    status,
  };
}

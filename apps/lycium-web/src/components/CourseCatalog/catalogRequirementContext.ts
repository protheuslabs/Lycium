import type { LyciumRequirement, LyciumRequirementGroup } from "@lycium/contracts";
import { leafRequirements, requirementCourseIds } from "../../utils/programProgressRollup";

export type CatalogCourseRequirementContext = {
  id: string;
  title: string;
  required: boolean;
  importance?: LyciumRequirement["importance"];
};

function requirementFallbackTitle(requirement: LyciumRequirement): string {
  if (requirement.type === "complete_n_of_courses") {
    return `Complete ${requirement.count} of ${requirement.courseIds.length} courses`;
  }
  if (requirement.type === "complete_course") {
    return "Complete course";
  }
  if (requirement.type === "pass_assessment") {
    return "Pass assessment";
  }
  if (requirement.type === "submit_project") {
    return "Submit project";
  }
  if (requirement.type === "demonstrate_competency") {
    return "Demonstrate competency";
  }
  if (requirement.type === "earn_hours") {
    return `Earn ${requirement.minimumHours} hours`;
  }
  return requirement.id;
}

function requirementContext(requirement: LyciumRequirement): CatalogCourseRequirementContext {
  return {
    id: requirement.id,
    title: requirement.title?.trim() || requirementFallbackTitle(requirement),
    required: requirement.required !== false,
    importance: requirement.importance,
  };
}

export function groupCourseRequirementContexts(
  group: LyciumRequirementGroup | null,
): Map<string, CatalogCourseRequirementContext[]> {
  const contextByCourseId = new Map<string, CatalogCourseRequirementContext[]>();
  if (!group) {
    return contextByCourseId;
  }

  for (const requirement of leafRequirements(group.requirements)) {
    const courseIds = requirementCourseIds(requirement);
    if (courseIds.length === 0) {
      continue;
    }

    const context = requirementContext(requirement);
    for (const courseId of courseIds) {
      const existing = contextByCourseId.get(courseId) ?? [];
      if (!existing.some((candidate) => candidate.id === context.id)) {
        contextByCourseId.set(courseId, [...existing, context]);
      }
    }
  }

  return contextByCourseId;
}

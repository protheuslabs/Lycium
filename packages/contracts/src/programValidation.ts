import type {
  LyciumCompletionRule,
  LyciumProgram,
  LyciumProgramValidationOptions,
  LyciumProgramValidationResult,
  LyciumRequirement,
} from "./programTypes";

function toSet(values?: Iterable<string>): Set<string> | null {
  return values ? new Set(values) : null;
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function pushMissing(errors: string[], label: string, value: unknown): void {
  if (!hasText(value)) {
    errors.push(`${label} is required.`);
  }
}

function checkKnownId(errors: string[], knownIds: Set<string> | null, label: string, id: string): void {
  if (knownIds && !knownIds.has(id)) {
    errors.push(`${label} references missing id: ${id}.`);
  }
}

function validateRequirement(
  requirement: LyciumRequirement,
  label: string,
  known: {
    courseIds: Set<string> | null;
    assessmentIds: Set<string> | null;
    projectIds: Set<string> | null;
    competencyIds: Set<string> | null;
  },
): string[] {
  const errors: string[] = [];
  pushMissing(errors, `${label}.id`, requirement.id);

  if (requirement.type === "complete_course") {
    pushMissing(errors, `${label}.courseId`, requirement.courseId);
    checkKnownId(errors, known.courseIds, `${label}.courseId`, requirement.courseId);
  }

  if (requirement.type === "complete_n_of_courses") {
    if (!Number.isFinite(requirement.count) || requirement.count < 1) {
      errors.push(`${label}.count must be at least 1.`);
    }
    if (!requirement.courseIds?.length) {
      errors.push(`${label}.courseIds must include at least one course.`);
    }
    if (requirement.count > requirement.courseIds.length) {
      errors.push(`${label}.count cannot exceed available courseIds.`);
    }
    for (const courseId of requirement.courseIds ?? []) {
      checkKnownId(errors, known.courseIds, `${label}.courseIds`, courseId);
    }
  }

  if (requirement.type === "pass_assessment") {
    pushMissing(errors, `${label}.assessmentId`, requirement.assessmentId);
    checkKnownId(errors, known.assessmentIds, `${label}.assessmentId`, requirement.assessmentId);
  }

  if (requirement.type === "submit_project") {
    pushMissing(errors, `${label}.projectId`, requirement.projectId);
    checkKnownId(errors, known.projectIds, `${label}.projectId`, requirement.projectId);
  }

  if (requirement.type === "demonstrate_competency") {
    pushMissing(errors, `${label}.competencyId`, requirement.competencyId);
    checkKnownId(errors, known.competencyIds, `${label}.competencyId`, requirement.competencyId);
  }

  if (requirement.type === "earn_hours" && (!Number.isFinite(requirement.minimumHours) || requirement.minimumHours <= 0)) {
    errors.push(`${label}.minimumHours must be greater than 0.`);
  }

  return errors;
}

function validateCompletionRule(rule: LyciumCompletionRule, label: string): string[] {
  const errors: string[] = [];
  if (rule.type === "complete_n_of" && (!Number.isFinite(rule.count) || rule.count < 1)) {
    errors.push(`${label}.completionRule.count must be at least 1.`);
  }
  if (rule.type === "earn_minimum_hours" && (!Number.isFinite(rule.hours) || rule.hours <= 0)) {
    errors.push(`${label}.completionRule.hours must be greater than 0.`);
  }
  if (rule.type === "custom") {
    pushMissing(errors, `${label}.completionRule.ruleId`, rule.ruleId);
  }
  return errors;
}

export function validateLyciumProgram(
  program: LyciumProgram,
  options: LyciumProgramValidationOptions = {},
): LyciumProgramValidationResult {
  const errors: string[] = [];
  const known = {
    courseIds: toSet(options.courseIds),
    assessmentIds: toSet(options.assessmentIds),
    projectIds: toSet(options.projectIds),
    competencyIds: toSet(options.competencyIds),
  };
  const nodeIds = new Set<string>();
  const requirementIds = new Set<string>();

  pushMissing(errors, "program.id", program.id);
  pushMissing(errors, "program.title", program.title);
  pushMissing(errors, "program.description", program.description);
  pushMissing(errors, "program.targetOutcome", program.targetOutcome);
  if (!program.requirementGroups?.length) {
    errors.push("program.requirementGroups must include at least one group.");
  }
  if (!Number.isFinite(program.estimatedHours) || program.estimatedHours <= 0) {
    errors.push("program.estimatedHours must be greater than 0.");
  }

  if (program.id) nodeIds.add(program.id);
  for (const outcome of program.learningOutcomes ?? []) {
    if (outcome.id) nodeIds.add(outcome.id);
  }

  for (const [index, requirement] of (program.entryRequirements ?? []).entries()) {
    errors.push(...validateRequirement(requirement, `program.entryRequirements[${index}]`, known));
    if (requirement.id) nodeIds.add(requirement.id);
  }

  for (const [groupIndex, group] of (program.requirementGroups ?? []).entries()) {
    const groupLabel = `program.requirementGroups[${groupIndex}]`;
    pushMissing(errors, `${groupLabel}.id`, group.id);
    pushMissing(errors, `${groupLabel}.displayName`, group.displayName);
    pushMissing(errors, `${groupLabel}.purpose`, group.purpose);
    if (group.id) nodeIds.add(group.id);
    errors.push(...validateCompletionRule(group.completionRule, groupLabel));

    for (const [requirementIndex, requirement] of (group.requirements ?? []).entries()) {
      const requirementLabel = `${groupLabel}.requirements[${requirementIndex}]`;
      errors.push(...validateRequirement(requirement, requirementLabel, known));
      if (requirement.id) {
        if (requirementIds.has(requirement.id)) {
          errors.push(`${requirementLabel}.id is duplicated: ${requirement.id}.`);
        }
        requirementIds.add(requirement.id);
        nodeIds.add(requirement.id);
      }
    }
  }

  for (const [index, edge] of (program.dependencyGraph?.edges ?? []).entries()) {
    if (!nodeIds.has(edge.fromNodeId)) {
      errors.push(`program.dependencyGraph.edges[${index}].fromNodeId is not a known node: ${edge.fromNodeId}.`);
    }
    if (!nodeIds.has(edge.toNodeId)) {
      errors.push(`program.dependencyGraph.edges[${index}].toNodeId is not a known node: ${edge.toNodeId}.`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export function formatProgramValidationErrors(errors: string[]): string {
  return errors.join("; ");
}

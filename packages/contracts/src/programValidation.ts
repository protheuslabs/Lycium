import type {
  LyciumCompletionRule,
  LyciumProgram,
  LyciumProgramValidationOptions,
  LyciumProgramValidationResult,
  LyciumRequirement,
  LyciumRequirementGroup,
} from "./programTypes";

function toSet(values?: Iterable<string>): Set<string> | null {
  return values ? new Set(values) : null;
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function pushMissing(errors: string[], label: string, value: unknown): void {
  if (!hasText(value)) errors.push(`${label} is required.`);
}

function checkKnownId(errors: string[], knownIds: Set<string> | null, label: string, id: string): void {
  if (knownIds && !knownIds.has(id)) errors.push(`${label} references missing id: ${id}.`);
}

function requirementIds(requirement: LyciumRequirement): string[] {
  if (requirement.type !== "requirement_set") return requirement.id ? [requirement.id] : [];
  return [requirement.id, ...requirement.requirements.flatMap(requirementIds)].filter(Boolean);
}

function requirementEstimatedHours(requirement: LyciumRequirement): number {
  if (Number.isFinite(requirement.estimatedHours)) return requirement.estimatedHours ?? 0;
  if (requirement.type === "earn_hours") return requirement.minimumHours;
  if (requirement.type === "requirement_set") return requirement.requirements.reduce((sum, nested) => sum + requirementEstimatedHours(nested), 0);
  return 0;
}

function requirementHasAssessment(requirement: LyciumRequirement, assessmentId: string): boolean {
  if (requirement.type === "pass_assessment") return requirement.assessmentId === assessmentId;
  return requirement.type === "requirement_set" && requirement.requirements.some((nested) => requirementHasAssessment(nested, assessmentId));
}

function requirementHasProject(requirement: LyciumRequirement, projectId: string): boolean {
  if (requirement.type === "submit_project") return requirement.projectId === projectId;
  return requirement.type === "requirement_set" && requirement.requirements.some((nested) => requirementHasProject(nested, projectId));
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
    if (!Number.isFinite(requirement.count) || requirement.count < 1) errors.push(`${label}.count must be at least 1.`);
    if (!requirement.courseIds?.length) errors.push(`${label}.courseIds must include at least one course.`);
    if (requirement.count > requirement.courseIds.length) errors.push(`${label}.count cannot exceed available courseIds.`);
    for (const courseId of requirement.courseIds ?? []) checkKnownId(errors, known.courseIds, `${label}.courseIds`, courseId);
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
  if (requirement.type === "requirement_set") {
    if (!requirement.requirements?.length) errors.push(`${label}.requirements must include at least one nested requirement.`);
    if (requirement.operator === "n_of" && (!Number.isFinite(requirement.count) || !requirement.count || requirement.count < 1)) {
      errors.push(`${label}.count must be at least 1 when operator is n_of.`);
    }
    if (requirement.operator === "n_of" && requirement.count && requirement.count > requirement.requirements.length) {
      errors.push(`${label}.count cannot exceed nested requirements length.`);
    }
    for (const [index, nestedRequirement] of (requirement.requirements ?? []).entries()) {
      errors.push(...validateRequirement(nestedRequirement, `${label}.requirements[${index}]`, known));
    }
  }

  return errors;
}

function validateCompletionRule(rule: LyciumCompletionRule, group: LyciumRequirementGroup, label: string): string[] {
  const errors: string[] = [];
  const requiredCount = group.requirements.filter((requirement) => requirement.required !== false).length;
  const estimatedHours = group.requirements.reduce((sum, requirement) => sum + requirementEstimatedHours(requirement), 0);

  if (rule.type === "complete_n_of" && (!Number.isFinite(rule.count) || rule.count < 1)) {
    errors.push(`${label}.completionRule.count must be at least 1.`);
  }
  if (rule.type === "complete_n_of" && rule.count > requiredCount) {
    errors.push(`${label}.completionRule.count cannot exceed required requirement count.`);
  }
  if (rule.type === "earn_minimum_hours" && (!Number.isFinite(rule.hours) || rule.hours <= 0)) {
    errors.push(`${label}.completionRule.hours must be greater than 0.`);
  }
  if (rule.type === "earn_minimum_hours" && estimatedHours > 0 && rule.hours > estimatedHours) {
    errors.push(`${label}.completionRule.hours cannot exceed available estimated requirement hours.`);
  }
  if (rule.type === "pass_assessment" && !group.requirements.some((requirement) => requirementHasAssessment(requirement, rule.assessmentId))) {
    errors.push(`${label}.completionRule.assessmentId must reference an assessment requirement in the group.`);
  }
  if (rule.type === "submit_project" && !group.requirements.some((requirement) => requirementHasProject(requirement, rule.projectId))) {
    errors.push(`${label}.completionRule.projectId must reference a project requirement in the group.`);
  }
  if (rule.type === "custom") pushMissing(errors, `${label}.completionRule.ruleId`, rule.ruleId);
  return errors;
}

function cycleErrors(edges: { fromNodeId: string; toNodeId: string }[]): string[] {
  const graph = new Map<string, string[]>();
  for (const edge of edges) graph.set(edge.fromNodeId, [...(graph.get(edge.fromNodeId) ?? []), edge.toNodeId]);
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const errors: string[] = [];

  const visit = (node: string, path: string[]) => {
    if (visiting.has(node)) {
      errors.push(`program.dependencyGraph contains a cycle: ${[...path, node].join(" -> ")}.`);
      return;
    }
    if (visited.has(node)) return;
    visiting.add(node);
    for (const next of graph.get(node) ?? []) visit(next, [...path, node]);
    visiting.delete(node);
    visited.add(node);
  };

  for (const node of graph.keys()) visit(node, []);
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
  const groupIds = new Set<string>();
  const seenRequirementIds = new Set<string>();

  pushMissing(errors, "program.id", program.id);
  pushMissing(errors, "program.title", program.title);
  pushMissing(errors, "program.description", program.description);
  pushMissing(errors, "program.targetOutcome", program.targetOutcome);
  if (!program.requirementGroups?.length) errors.push("program.requirementGroups must include at least one group.");
  if (!Number.isFinite(program.estimatedHours) || program.estimatedHours <= 0) errors.push("program.estimatedHours must be greater than 0.");
  if (program.id) nodeIds.add(program.id);
  for (const outcome of program.learningOutcomes ?? []) if (outcome.id) nodeIds.add(outcome.id);

  for (const [index, requirement] of (program.entryRequirements ?? []).entries()) {
    errors.push(...validateRequirement(requirement, `program.entryRequirements[${index}]`, known));
    for (const id of requirementIds(requirement)) nodeIds.add(id);
  }

  for (const [groupIndex, group] of (program.requirementGroups ?? []).entries()) {
    const groupLabel = `program.requirementGroups[${groupIndex}]`;
    pushMissing(errors, `${groupLabel}.id`, group.id);
    pushMissing(errors, `${groupLabel}.displayName`, group.displayName);
    pushMissing(errors, `${groupLabel}.purpose`, group.purpose);
    if (group.id) {
      if (groupIds.has(group.id)) errors.push(`${groupLabel}.id is duplicated: ${group.id}.`);
      groupIds.add(group.id);
      nodeIds.add(group.id);
    }
    errors.push(...validateCompletionRule(group.completionRule, group, groupLabel));
    for (const prerequisite of group.prerequisites ?? []) {
      const prerequisiteNodeId = typeof prerequisite === "string" ? prerequisite : prerequisite.nodeId;
      if (!groupIds.has(prerequisiteNodeId) && !nodeIds.has(prerequisiteNodeId)) {
        errors.push(`${groupLabel}.prerequisites references unknown node: ${prerequisiteNodeId}.`);
      }
    }

    for (const [requirementIndex, requirement] of (group.requirements ?? []).entries()) {
      const requirementLabel = `${groupLabel}.requirements[${requirementIndex}]`;
      errors.push(...validateRequirement(requirement, requirementLabel, known));
      for (const id of requirementIds(requirement)) {
        if (seenRequirementIds.has(id)) errors.push(`${requirementLabel}.id is duplicated: ${id}.`);
        seenRequirementIds.add(id);
        nodeIds.add(id);
      }
    }
  }

  const hasCapstone = (program.requirementGroups ?? []).some(
    (group) => group.groupKind === "capstone" || group.requirements.some((requirement) => requirement.type === "submit_project"),
  );
  if ((program.programType === "career_path" || program.programType === "degree_equivalent" || program.masteryPolicy.requiresCapstone) && !hasCapstone) {
    errors.push("program requires a capstone group or project requirement.");
  }

  for (const [index, edge] of (program.dependencyGraph?.edges ?? []).entries()) {
    if (!nodeIds.has(edge.fromNodeId)) errors.push(`program.dependencyGraph.edges[${index}].fromNodeId is not a known node: ${edge.fromNodeId}.`);
    if (!nodeIds.has(edge.toNodeId)) errors.push(`program.dependencyGraph.edges[${index}].toNodeId is not a known node: ${edge.toNodeId}.`);
  }
  errors.push(...cycleErrors(program.dependencyGraph?.edges ?? []));

  return { valid: errors.length === 0, errors };
}

export function formatProgramValidationErrors(errors: string[]): string {
  return errors.join("; ");
}

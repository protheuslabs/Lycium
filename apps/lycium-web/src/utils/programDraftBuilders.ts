import type {
  LyciumLearningOutcome,
  LyciumProgram,
  LyciumRequirement,
  LyciumRequirementGroup,
} from "@lycium/contracts";
import type { CourseEntry } from "../courseTypes";

function stampId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}`;
}

function courseEstimatedHours(course: CourseEntry): number | undefined {
  const estimatedHours = (course.data as { estimatedHours?: unknown }).estimatedHours;
  return typeof estimatedHours === "number" && estimatedHours > 0 ? estimatedHours : undefined;
}

function sumDefined(values: Array<number | undefined>): number | undefined {
  const filtered = values.filter((value): value is number => typeof value === "number" && value > 0);
  if (filtered.length === 0) {
    return undefined;
  }
  return filtered.reduce((total, value) => total + value, 0);
}

function cloneLearningOutcome(outcome: LyciumLearningOutcome, prefix: string, index: number): LyciumLearningOutcome {
  return {
    ...outcome,
    id: `${prefix}-outcome-${index + 1}`,
  };
}

function cloneRequirement(requirement: LyciumRequirement, prefix: string, path: string): LyciumRequirement {
  const nextId = `${prefix}-requirement-${path}`;

  if (requirement.type === "requirement_set") {
    return {
      ...requirement,
      id: nextId,
      requirements: requirement.requirements.map((nested, index) =>
        cloneRequirement(nested, prefix, `${path}-${index + 1}`),
      ),
    };
  }

  return {
    ...requirement,
    id: nextId,
  };
}

function cloneRequirementGroup(
  group: LyciumRequirementGroup,
  sourceProgram: LyciumProgram,
  programId: string,
  index: number,
): LyciumRequirementGroup {
  const prefix = `${programId}-group-${index + 1}`;
  return {
    ...group,
    id: prefix,
    displayName: group.displayName,
    purpose: group.purpose || `Cluster drawn from ${sourceProgram.title}.`,
    locked: false,
    learningOutcomes: group.learningOutcomes.map((outcome, outcomeIndex) =>
      cloneLearningOutcome(outcome, prefix, outcomeIndex),
    ),
    requirements: group.requirements.map((requirement, requirementIndex) =>
      cloneRequirement(requirement, prefix, `${requirementIndex + 1}`),
    ),
    prerequisites: undefined,
  };
}

function uniqueLearningOutcomes(outcomes: LyciumLearningOutcome[]): LyciumLearningOutcome[] {
  const seen = new Set<string>();
  return outcomes.filter((outcome) => {
    const key = `${outcome.statement}::${outcome.id}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function buildLocalProgramDraftFromClusters(
  selections: Array<{ program: LyciumProgram; cluster: LyciumRequirementGroup }>,
): LyciumProgram {
  const draftId = stampId("local-program");
  const sourcePrograms = selections.map(({ program }) => program);
  const firstProgram = sourcePrograms[0];
  const sharedProgramId = new Set(sourcePrograms.map((program) => program.id)).size === 1 ? firstProgram?.id : null;
  const title = sharedProgramId && firstProgram ? `Fork of ${firstProgram.title}` : "Custom program";
  const description = sharedProgramId && firstProgram
    ? `Local draft program assembled from selected clusters in ${firstProgram.title}.`
    : "Local draft program assembled from selected clusters.";
  const requirementGroups = selections.map(({ program, cluster }, index) =>
    cloneRequirementGroup(cluster, program, draftId, index),
  );
  const learningOutcomes = uniqueLearningOutcomes(
    requirementGroups.flatMap((group) => group.learningOutcomes),
  );
  const estimatedHours = Math.max(
    1,
    Math.round(
      sumDefined(requirementGroups.map((group) => group.estimatedHours)) ??
        selections.length * 12,
    ),
  );

  return {
    id: draftId,
    title,
    description,
    programType: firstProgram?.programType ?? "skill_path",
    field: firstProgram?.field ?? "General Studies",
    level: firstProgram?.level ?? "undergraduate",
    targetOutcome: `Complete the selected learning pathway for ${title}.`,
    learningOutcomes,
    entryRequirements: [],
    requirementGroups,
    estimatedHours,
    masteryPolicy: firstProgram?.masteryPolicy ?? {
      minimumMasteryPercent: 100,
      remediationPolicy: "recommended",
    },
    credentialPolicy: firstProgram?.credentialPolicy ?? {
      credentialType: "portfolio_record",
      title: `${title} evidence`,
      requiresHumanReview: false,
    },
    dependencyGraph: { edges: [] },
    version: "local-draft",
    reviewStatus: "draft",
  };
}

export function buildEmptyLocalProgramDraft(
  title = "Untitled program",
  description = "A blank local program draft.",
): LyciumProgram {
  const draftId = stampId("local-program");

  return {
    id: draftId,
    title,
    description,
    programType: "skill_path",
    field: "General Studies",
    level: "undergraduate",
    targetOutcome: `Complete ${title}.`,
    learningOutcomes: [],
    entryRequirements: [],
    requirementGroups: [],
    estimatedHours: 1,
    masteryPolicy: {
      minimumMasteryPercent: 100,
      remediationPolicy: "recommended",
    },
    credentialPolicy: {
      credentialType: "portfolio_record",
      title: `${title} evidence`,
      requiresHumanReview: false,
    },
    dependencyGraph: { edges: [] },
    version: "local-draft",
    reviewStatus: "draft",
  };
}

export function buildEmptyRequirementGroupDraft(
  program: LyciumProgram,
  title = "Untitled cluster",
  description = "",
): LyciumRequirementGroup {
  const draftId = stampId(`${program.id}-cluster`);

  return {
    id: draftId,
    displayName: title,
    groupKind: "cluster",
    purpose: description || `Local draft cluster assembled for ${program.title}.`,
    locked: false,
    learningOutcomes: [],
    requirements: [],
    completionRule: { type: "complete_all" },
    estimatedHours: undefined,
    masteryPolicy: {
      minimumMasteryPercent: 100,
      remediationPolicy: "recommended",
    },
  };
}

export function appendCoursesToRequirementGroup(
  group: LyciumRequirementGroup,
  courses: CourseEntry[],
): LyciumRequirementGroup {
  const existingCourseIds = new Set(
    group.requirements.flatMap((requirement) =>
      requirement.type === "complete_course" ? [requirement.courseId] : [],
    ),
  );
  const appendedRequirements = courses
    .filter((course) => !existingCourseIds.has(course.key))
    .map((course, index) => ({
      id: `${group.id}-course-${group.requirements.length + index + 1}`,
      type: "complete_course" as const,
      courseId: course.key,
      title: course.title,
      required: true,
      estimatedHours: courseEstimatedHours(course),
    }));
  const nextRequirements = [...group.requirements, ...appendedRequirements];

  return {
    ...group,
    requirements: nextRequirements,
    estimatedHours: sumDefined(courses.map(courseEstimatedHours)) ?? group.estimatedHours,
  };
}

export function cloneRequirementGroupIntoProgram(
  program: LyciumProgram,
  sourceProgram: LyciumProgram,
  group: LyciumRequirementGroup,
): LyciumRequirementGroup {
  return cloneRequirementGroup(
    group,
    sourceProgram,
    program.id,
    program.requirementGroups.length,
  );
}

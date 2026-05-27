import type {
  LyciumCurriculumBenchmark,
  LyciumCurriculumBenchmarkSourceType,
  LyciumRequirementImportance,
  LyciumRequirementOriginType,
} from "./curriculumBenchmarkTypes";

const sourceTypes = new Set<LyciumCurriculumBenchmarkSourceType>([
  "university_catalog",
  "syllabus",
  "certification_exam",
  "employer_profile",
  "expert_reference",
]);

const importanceLevels = new Set<LyciumRequirementImportance>([
  "required",
  "recommended",
  "optional",
  "remedial",
  "alternate",
  "enrichment",
]);

const originTypes = new Set<LyciumRequirementOriginType>([
  "common_academic_requirement",
  "certification_requirement",
  "employer_requirement",
  "expert_review",
  "generated_gap_fill",
]);

export function validateCurriculumBenchmark(benchmark: LyciumCurriculumBenchmark): string[] {
  const errors: string[] = [];

  if (!benchmark.id) errors.push("Benchmark is missing id.");
  if (!benchmark.title) errors.push("Benchmark is missing title.");
  if (!sourceTypes.has(benchmark.sourceType)) {
    errors.push(`Benchmark has unsupported sourceType '${benchmark.sourceType}'.`);
  }
  if (!Number.isFinite(benchmark.confidence) || benchmark.confidence < 0 || benchmark.confidence > 1) {
    errors.push("Benchmark confidence must be between 0 and 1.");
  }
  if (!Array.isArray(benchmark.topics) || benchmark.topics.length === 0) {
    errors.push("Benchmark must include at least one topic.");
  }
  if (!Array.isArray(benchmark.learningOutcomes) || benchmark.learningOutcomes.length === 0) {
    errors.push("Benchmark must include at least one learning outcome.");
  }
  if (!Array.isArray(benchmark.extractedRequirements) || benchmark.extractedRequirements.length === 0) {
    errors.push("Benchmark must include at least one extracted requirement.");
    return errors;
  }

  const requirementIds = new Set<string>();
  for (const requirement of benchmark.extractedRequirements) {
    if (!requirement.id) errors.push("Benchmark requirement is missing id.");
    if (requirement.id && requirementIds.has(requirement.id)) {
      errors.push(`Duplicate benchmark requirement id '${requirement.id}'.`);
    }
    if (requirement.id) requirementIds.add(requirement.id);
    if (!requirement.title) errors.push(`Benchmark requirement '${requirement.id}' is missing title.`);
    if (!importanceLevels.has(requirement.importance)) {
      errors.push(`Benchmark requirement '${requirement.id}' has unsupported importance '${requirement.importance}'.`);
    }
    if (requirement.origin) {
      if (!originTypes.has(requirement.origin.originType)) {
        errors.push(`Requirement '${requirement.id}' has unsupported originType '${requirement.origin.originType}'.`);
      }
      if (!Array.isArray(requirement.origin.evidenceRefs) || requirement.origin.evidenceRefs.length === 0) {
        errors.push(`Requirement '${requirement.id}' origin must include evidenceRefs.`);
      }
      if (
        requirement.origin.frequency !== undefined &&
        (!Number.isFinite(requirement.origin.frequency) || requirement.origin.frequency < 0 || requirement.origin.frequency > 1)
      ) {
        errors.push(`Requirement '${requirement.id}' origin frequency must be between 0 and 1.`);
      }
    }
  }

  return errors;
}

import type { LyciumRequirementImportance, LyciumRequirementOrigin } from "./curriculumBenchmarkTypes";

export const LYCIUM_PROGRAM_CONTRACT_VERSION = "0.1.0" as const;

export type LyciumProgramType =
  | "career_path"
  | "certificate"
  | "degree_equivalent"
  | "skill_path"
  | "exam_prep"
  | "microcredential";

export type LyciumProgramLevel = "foundational" | "undergraduate" | "graduate" | "professional";
export type LyciumProgramReviewStatus = "draft" | "reviewed" | "published" | "deprecated";

export type LyciumLearningOutcome = {
  id: string;
  statement: string;
  competencyIds?: string[];
  sourceIds?: string[];
};

export type LyciumMasteryPolicy = {
  minimumMasteryPercent?: number;
  minimumAssessmentPercent?: number;
  requiresCapstone?: boolean;
  remediationPolicy?: "optional" | "recommended" | "required";
};

export type LyciumCredentialPolicy = {
  credentialType?: "certificate" | "badge" | "portfolio_record" | "transcript_record";
  title?: string;
  issuer?: string;
  requiresHumanReview?: boolean;
};

export type LyciumCompletionRule =
  | { type: "complete_all" }
  | { type: "complete_n_of"; count: number }
  | { type: "earn_minimum_hours"; hours: number }
  | { type: "pass_assessment"; assessmentId: string; minScore?: number }
  | { type: "submit_project"; projectId: string }
  | { type: "custom"; ruleId: string };

export type LyciumRequirementBase = {
  id: string;
  title?: string;
  required?: boolean;
  estimatedHours?: number;
  learningOutcomeIds?: string[];
  importance?: LyciumRequirementImportance;
  origin?: LyciumRequirementOrigin;
  alternateRequirementIds?: string[];
};

export type LyciumRequirement =
  | (LyciumRequirementBase & { type: "complete_course"; courseId: string })
  | (LyciumRequirementBase & { type: "complete_n_of_courses"; count: number; courseIds: string[] })
  | (LyciumRequirementBase & { type: "pass_assessment"; assessmentId: string; minScore: number })
  | (LyciumRequirementBase & { type: "submit_project"; projectId: string })
  | (LyciumRequirementBase & { type: "demonstrate_competency"; competencyId: string })
  | (LyciumRequirementBase & { type: "earn_hours"; minimumHours: number })
  | (LyciumRequirementBase & {
      type: "requirement_set";
      operator: "all" | "any" | "n_of";
      count?: number;
      requirements: LyciumRequirement[];
    });

export type LyciumRequirementGroupKind =
  | "cluster"
  | "track"
  | "concentration"
  | "elective_pool"
  | "foundation"
  | "capstone"
  | "bridge"
  | "remedial"
  | "lab"
  | "seminar";

export type LyciumRequirementGroup = {
  id: string;
  displayName: string;
  groupKind: LyciumRequirementGroupKind;
  purpose: string;
  learningOutcomes: LyciumLearningOutcome[];
  requirements: LyciumRequirement[];
  completionRule: LyciumCompletionRule;
  estimatedHours?: number;
  masteryPolicy?: LyciumMasteryPolicy;
  prerequisites?: LyciumPrerequisiteRef[];
};

export type LyciumPrerequisiteRef = {
  nodeId: string;
  type?: "required" | "recommended" | "remedial";
};

export type LyciumDependencyEdgeType = "required" | "recommended" | "remedial";

export type LyciumDependencyEdge = {
  fromNodeId: string;
  toNodeId: string;
  type: LyciumDependencyEdgeType;
  rationale?: string;
};

export type LyciumDependencyGraph = {
  edges: LyciumDependencyEdge[];
};

export type LyciumProgram = {
  id: string;
  title: string;
  description: string;
  programType: LyciumProgramType;
  field: string;
  level: LyciumProgramLevel;
  targetOutcome: string;
  learningOutcomes: LyciumLearningOutcome[];
  entryRequirements: LyciumRequirement[];
  requirementGroups: LyciumRequirementGroup[];
  estimatedHours: number;
  masteryPolicy: LyciumMasteryPolicy;
  credentialPolicy?: LyciumCredentialPolicy;
  dependencyGraph?: LyciumDependencyGraph;
  version: string;
  reviewStatus: LyciumProgramReviewStatus;
};

export type LyciumProgramProgressState = {
  viewedPercent: number;
  exercisePercent: number;
  assessmentPercent: number;
  masteryPercent: number;
  projectArtifacts: number;
  status: "not_started" | "in_progress" | "blocked" | "review_needed" | "mastered";
};

export type LyciumProgramProgressInput = {
  viewedRequirementIds?: Iterable<string>;
  completedCourseIds?: Iterable<string>;
  passedAssessmentIds?: Iterable<string>;
  submittedProjectIds?: Iterable<string>;
  masteredCompetencyIds?: Iterable<string>;
  earnedHours?: number;
};

export type LyciumProgramValidationOptions = {
  courseIds?: Iterable<string>;
  assessmentIds?: Iterable<string>;
  projectIds?: Iterable<string>;
  competencyIds?: Iterable<string>;
};

export type LyciumProgramValidationResult = {
  valid: boolean;
  errors: string[];
};

export type LyciumCurriculumBenchmarkSourceType =
  | "university_catalog"
  | "syllabus"
  | "certification_exam"
  | "employer_profile"
  | "expert_reference";

export type LyciumRequirementImportance =
  | "required"
  | "recommended"
  | "optional"
  | "remedial"
  | "alternate"
  | "enrichment";

export type LyciumRequirementOriginType =
  | "common_academic_requirement"
  | "certification_requirement"
  | "employer_requirement"
  | "expert_review"
  | "generated_gap_fill";

export type LyciumPreferredModality =
  | "video_heavy"
  | "text_heavy"
  | "interactive"
  | "project_first"
  | "textbook_like"
  | "reference_first"
  | "quiz_heavy";

export type LyciumInstitutionCourseRef = {
  institution: string;
  title: string;
  department?: string;
  courseCode?: string;
  url?: string;
  catalogYear?: string;
  sourceIds?: string[];
  notes?: string;
};

export type LyciumRequirementOrigin = {
  originType: LyciumRequirementOriginType;
  evidenceRefs: string[];
  benchmarkIds?: string[];
  frequency?: number;
  notes?: string;
};

export type LyciumBenchmarkRequirement = {
  id: string;
  title: string;
  description?: string;
  importance: LyciumRequirementImportance;
  topics?: string[];
  learningOutcomeIds?: string[];
  origin?: LyciumRequirementOrigin;
};

export type LyciumCurriculumBenchmark = {
  id: string;
  sourceType: LyciumCurriculumBenchmarkSourceType;
  title: string;
  institution?: string;
  programName?: string;
  courseCode?: string;
  department?: string;
  url?: string;
  catalogYear?: string;
  sourceRefs?: string[];
  extractedRequirements: LyciumBenchmarkRequirement[];
  topics: string[];
  learningOutcomes: string[];
  confidence: number;
  extractedAt?: string;
  reviewedBy?: string;
  notes?: string;
};

export type LyciumCourseParityProfile = {
  id: string;
  benchmarkInstitutions: LyciumInstitutionCourseRef[];
  commonRequiredTopics: string[];
  optionalTopics?: string[];
  coveragePercent: number;
  parityStatus: "weak" | "partial" | "strong";
  requirementOrigins?: LyciumRequirementOrigin[];
};

export type LyciumCourseVariant = {
  courseId: string;
  title: string;
  modalityProfile?: LyciumPreferredModality[];
  pacingProfile?: "accelerated" | "standard" | "extended" | "self_paced";
  pedagogyProfile?: "academic" | "project_first" | "exam_prep" | "professional" | "visual_beginner";
  notes?: string;
};

export type LyciumCourseEquivalenceGroup = {
  id: string;
  title: string;
  satisfiesRequirementIds: string[];
  variants: LyciumCourseVariant[];
};

export type LyciumSourceSlot = {
  requiredConceptId: string;
  primarySourceId: string;
  fallbackSourceIds: string[];
  replacementPolicy: "auto_replace_if_broken" | "review_required";
};

export type LyciumPortfolioArtifactRequirement = {
  id: string;
  title: string;
  artifactType: "repo" | "essay" | "demo" | "presentation" | "lab_report" | "case_study";
  requiredEvidence: string[];
  rubricId?: string;
};

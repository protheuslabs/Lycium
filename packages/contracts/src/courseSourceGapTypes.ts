export type LyciumCourseSourceGapScopeType = "course" | "module" | "section" | "requirement" | "assessment";
export type LyciumCourseSourceGapSeverity = "blocking" | "recommended" | "optional";
export type LyciumCourseSourceTypeHint =
  | "textbook"
  | "syllabus"
  | "catalog"
  | "university_catalog"
  | "open_textbook"
  | "lecture"
  | "lecture_notes"
  | "documentation"
  | "paper"
  | "exercise"
  | "practice"
  | "video"
  | "simulation"
  | "lab"
  | "open_courseware"
  | "other";

export type LyciumCourseConceptSourceNeed = {
  concept: string;
  location?: string;
  sectionId?: string;
  sourceSectionId?: string;
  status?: "direct" | "inherited" | "missing" | string;
  sourceTypeHints?: LyciumCourseSourceTypeHint[] | string[];
  suggestedQueries?: string[];
};

export type LyciumCourseSourceResumeCoverage = {
  requiredConceptCount?: number;
  coveredConceptCount?: number;
  coveragePercent?: number;
  coveredConcepts?: string[];
  uncoveredConcepts?: string[];
};

export type LyciumCourseSourceGap = {
  id: string;
  scopeType: LyciumCourseSourceGapScopeType;
  scopeId: string;
  title: string;
  neededFor?: string;
  description?: string;
  requiredConcepts?: string[];
  conceptSourceNeeds?: LyciumCourseConceptSourceNeed[];
  sourceResumeCoverage?: LyciumCourseSourceResumeCoverage;
  recommendedSourceTypes?: LyciumCourseSourceTypeHint[] | string[];
  sourceTypeHints?: LyciumCourseSourceTypeHint[] | string[];
  minimumUsefulSources?: number;
  minimumSourceCount?: number;
  currentSourceCount: number;
  missingConceptSourceCount?: number;
  coverageGate?: Record<string, unknown>;
  severity: LyciumCourseSourceGapSeverity;
};

export type LyciumCourseSourceCoveragePolicy = {
  minimumCourseSources?: number;
  minimumSourcesPerModule?: number;
  minimumRequiredConceptCoveragePercent?: number;
  minimumSourceStrengthScore?: number;
  requireBenchmarkEvidence?: boolean;
  requireAssessmentCoverage?: boolean;
};

export type LyciumCourseGenerationReadiness = {
  contractVersion?: "course-generation-readiness-v1" | string;
  status?: "ready" | "needs_sources" | string;
  ready?: boolean;
  sourceEvidence?: {
    sourceUrlCount?: number;
    usableInputArtifactCount?: number;
    submittedEvidenceCount?: number;
    minimumCourseSources?: number;
    [key: string]: unknown;
  };
  conceptCoverage?: {
    status?: "ready" | "needs_sources" | string;
    coverageRatio?: number | null;
    minimumCoverageRatio?: number | null;
    requiredConceptCount?: number | null;
    coveredConceptCount?: number | null;
    uncoveredConcepts?: string[];
    coverageRows?: Record<string, unknown>[];
    [key: string]: unknown;
  };
  sourceStrength?: {
    score?: number;
    minimumScore?: number;
    status?: string;
    ready?: boolean;
    [key: string]: unknown;
  };
  sourceGate?: Record<string, unknown> | null;
  issues?: { code?: string; message: string }[];
  [key: string]: unknown;
};

export type LyciumCourseSourceGapSuggestion = {
  id?: string;
  gapId: string;
  url: string;
  description?: string | null;
  createdAt?: string;
};

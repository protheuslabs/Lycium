import type {
  CourseEntry,
  CourseData,
  LyciumCourseGenerationReadiness,
  LyciumCourseSourceCoveragePolicy,
  LyciumCourseSourceGap,
  LyciumCourseSourceGapSuggestion,
} from "../courseTypes";

export const DEFAULT_SOURCE_COVERAGE_POLICY: Required<LyciumCourseSourceCoveragePolicy> = {
  minimumCourseSources: 3,
  minimumSourcesPerModule: 1,
  minimumRequiredConceptCoveragePercent: 70,
  minimumSourceStrengthScore: 65,
  requireBenchmarkEvidence: false,
  requireAssessmentCoverage: true,
};

type SourceGapDraftInput = {
  prompt: string;
  level?: string;
  sourceLinks: string[];
  sourceFileNames?: string[];
  classification: { category: string; department: string };
};

type QueueSourceGapSuggestionInput = {
  gapId: string;
  url: string;
  description?: string;
};

function cleanPromptTitle(prompt: string): string {
  const normalized = prompt.trim().replace(/\s+/g, " ");
  if (!normalized) return "Untitled course";
  return normalized.length > 84 ? `${normalized.slice(0, 81).trim()}...` : normalized;
}

function draftKeyFromPrompt(prompt: string): string {
  const slug = cleanPromptTitle(prompt)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 54);
  return `draft-needs-sources-${slug || "course"}-${Date.now()}`;
}

export function submittedSourceCount(sourceLinks: string[], sourceFileNames: string[] = []): number {
  const linkCount = new Set(sourceLinks.map((link) => link.trim()).filter(Boolean)).size;
  const fileCount = new Set(sourceFileNames.map((name) => name.trim()).filter(Boolean)).size;
  return linkCount + fileCount;
}

export function sourceCountMeetsMinimum(sourceLinks: string[], sourceFileNames: string[] = []): boolean {
  return submittedSourceCount(sourceLinks, sourceFileNames) >= DEFAULT_SOURCE_COVERAGE_POLICY.minimumCourseSources;
}

export function getCourseSourceGaps(course: CourseEntry): LyciumCourseSourceGap[] {
  const gaps = course.data.metadata?.sourceGaps;
  return Array.isArray(gaps) ? gaps : [];
}

export function getCourseSourceGapSuggestions(course: CourseEntry): LyciumCourseSourceGapSuggestion[] {
  const suggestions = course.data.metadata?.sourceGapSuggestions;
  return Array.isArray(suggestions) ? suggestions : [];
}

export function getCourseGenerationReadiness(course: CourseEntry): LyciumCourseGenerationReadiness | null {
  const readiness = course.data.metadata?.generationReadiness;
  return readiness && typeof readiness === "object" ? readiness : null;
}

export function hasBlockingSourceGaps(course: CourseEntry): boolean {
  return course.status === "needs_sources" || getCourseSourceGaps(course).some((gap) => gap.severity === "blocking");
}

export function sourceGapNeededFor(gap: LyciumCourseSourceGap): string {
  return gap.neededFor || gap.description || "Add source evidence before this draft can continue.";
}

export function sourceGapRecommendedTypes(gap: LyciumCourseSourceGap): string[] {
  return Array.from(new Set([...(gap.recommendedSourceTypes ?? []), ...(gap.sourceTypeHints ?? [])].map(String).filter(Boolean)));
}

export function sourceGapMinimumUsefulSources(gap: LyciumCourseSourceGap): number {
  return gap.minimumUsefulSources ?? gap.minimumSourceCount ?? DEFAULT_SOURCE_COVERAGE_POLICY.minimumCourseSources;
}

export function sourceGapConceptCoverage(gap: LyciumCourseSourceGap) {
  const coverage = gap.sourceResumeCoverage;
  const conceptNeeds = gap.conceptSourceNeeds ?? [];
  const coveredConcepts = coverage?.coveredConcepts ?? [];
  const uncoveredConcepts =
    coverage?.uncoveredConcepts ??
    conceptNeeds.filter((need) => need.status !== "direct").map((need) => need.concept).filter(Boolean);
  return {
    coveragePercent: coverage?.coveragePercent ?? (conceptNeeds.length ? 0 : 100),
    coveredConcepts,
    uncoveredConcepts,
    requiredConceptCount: coverage?.requiredConceptCount ?? coveredConcepts.length + uncoveredConcepts.length,
    coveredConceptCount: coverage?.coveredConceptCount ?? coveredConcepts.length,
  };
}

export function sourceGapSummary(course: CourseEntry) {
  const gaps = getCourseSourceGaps(course);
  const blockingGaps = gaps.filter((gap) => gap.severity === "blocking");
  const policy = course.data.metadata?.sourceCoveragePolicy ?? DEFAULT_SOURCE_COVERAGE_POLICY;
  const requiredSourceCount = policy.minimumCourseSources ?? DEFAULT_SOURCE_COVERAGE_POLICY.minimumCourseSources;
  const currentSourceCount = new Set(course.data.sourceIds ?? []).size;
  const requiredConcepts = Array.from(
    new Set(
      gaps
        .flatMap((gap) => [...(gap.requiredConcepts ?? []), ...(gap.conceptSourceNeeds ?? []).map((need) => need.concept)])
        .map((concept) => concept.trim())
        .filter(Boolean),
    ),
  );
  const suggestedSourceTypes = Array.from(
    new Set(gaps.flatMap(sourceGapRecommendedTypes).map((sourceType) => sourceType.trim()).filter(Boolean)),
  );
  const coverageRows = gaps.map(sourceGapConceptCoverage).filter((coverage) => coverage.requiredConceptCount > 0);
  const totalRequiredConcepts = coverageRows.reduce((total, coverage) => total + coverage.requiredConceptCount, 0);
  const totalCoveredConcepts = coverageRows.reduce((total, coverage) => total + coverage.coveredConceptCount, 0);

  return {
    gaps,
    blockingGaps,
    policy,
    requiredSourceCount,
    currentSourceCount,
    requiredConcepts,
    suggestedSourceTypes,
    suggestionCount: getCourseSourceGapSuggestions(course).length,
    conceptCoveragePercent: totalRequiredConcepts ? Math.round((totalCoveredConcepts / totalRequiredConcepts) * 100) : 100,
    totalRequiredConcepts,
    totalCoveredConcepts,
  };
}

export function createSourceGapDraftCourse({
  prompt,
  level,
  sourceLinks,
  sourceFileNames = [],
  classification,
}: SourceGapDraftInput): CourseEntry {
  const title = cleanPromptTitle(prompt);
  const uniqueLinks = Array.from(new Set(sourceLinks.map((link) => link.trim()).filter(Boolean)));
  const uniqueFileNames = Array.from(new Set(sourceFileNames.map((name) => name.trim()).filter(Boolean)));
  const linkSourceRecords = uniqueLinks.map((url, index) => ({
    id: `submitted-source-${index + 1}`,
    type: "submitted_url",
    title: `Submitted source ${index + 1}`,
    url,
  }));
  const fileSourceRecords = uniqueFileNames.map((filename, index) => ({
    id: `submitted-file-${index + 1}`,
    type: "submitted_file",
    title: filename,
  }));
  const sourceRecords = [...linkSourceRecords, ...fileSourceRecords];
  const sourceIds = sourceRecords.map((source) => source.id);
  const sourceCount = sourceIds.length;
  const sourceGaps: LyciumCourseSourceGap[] = [
    {
      id: "course-benchmark-sources",
      scopeType: "course",
      scopeId: "course",
      title: "Benchmark and scope sources",
      neededFor: "Confirm the course level, expected topics, prerequisites, and required coverage before full generation.",
      requiredConcepts: ["course scope", "required topics", "prerequisites"],
      recommendedSourceTypes: ["syllabus", "catalog", "textbook", "open_courseware"],
      minimumUsefulSources: 2,
      currentSourceCount: Math.min(sourceCount, 2),
      severity: "blocking",
    },
    {
      id: "module-instruction-sources",
      scopeType: "module",
      scopeId: "planned-modules",
      title: "Module-level instructional sources",
      neededFor: "Draft learnable modules with source-backed explanations instead of placeholder prose.",
      requiredConcepts: ["module sequence", "instructional examples", "practice coverage"],
      recommendedSourceTypes: ["textbook", "lecture", "documentation", "video", "open_courseware"],
      minimumUsefulSources: DEFAULT_SOURCE_COVERAGE_POLICY.minimumCourseSources,
      currentSourceCount: sourceCount,
      severity: "blocking",
    },
    {
      id: "assessment-sources",
      scopeType: "assessment",
      scopeId: "course-assessments",
      title: "Assessment coverage sources",
      neededFor: "Create quizzes and practice tasks that assess taught or sourced concepts.",
      requiredConcepts: ["quiz coverage", "practice tasks", "assessment alignment"],
      recommendedSourceTypes: ["exercise", "textbook", "open_courseware"],
      minimumUsefulSources: 1,
      currentSourceCount: 0,
      severity: "recommended",
    },
  ];

  const data: CourseData = {
    title,
    shortDescription: "Course draft waiting for enough source evidence before full generation.",
    difficultyLevel: level || "Not set",
    category: classification.category,
    department: classification.department,
    tags: [],
    learningTypes: [],
    sourceIds,
    sourceRecords,
    metadata: {
      sourceCoveragePolicy: DEFAULT_SOURCE_COVERAGE_POLICY,
      sourceGaps,
      generationPlan: {
        status: ["scoped", "needs_sources"],
        sourceMap: {},
      },
    },
    modules: [
      {
        id: "source-planning",
        title: "Source planning",
        sections: [
          {
            id: "source-gaps",
            title: "Sources needed before generation",
            pageType: "learn",
            sectionType: "lesson",
            content: [
              {
                type: "text",
                value: "This draft is intentionally blocked until enough source evidence is attached for full course generation.",
                sourceIds,
              },
            ],
            sourceIds,
          },
        ],
        sourceIds,
      },
    ],
  };

  return {
    key: draftKeyFromPrompt(prompt),
    title,
    data,
    source: "local",
    status: "needs_sources",
  };
}

export function queueCourseSourceGapSuggestion(
  course: CourseEntry,
  suggestion: QueueSourceGapSuggestionInput,
): CourseEntry {
  const existingSuggestions = getCourseSourceGapSuggestions(course);
  const nextSuggestion: LyciumCourseSourceGapSuggestion = {
    id: `source-gap-suggestion-${Date.now()}`,
    gapId: suggestion.gapId,
    url: suggestion.url.trim(),
    description: suggestion.description?.trim() || null,
    createdAt: new Date().toISOString(),
  };

  return {
    ...course,
    data: {
      ...course.data,
      metadata: {
        ...course.data.metadata,
        sourceGapSuggestions: [nextSuggestion, ...existingSuggestions],
      },
    },
  };
}

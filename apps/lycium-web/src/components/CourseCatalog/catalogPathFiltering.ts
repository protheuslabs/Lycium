import type { LyciumProgram, LyciumRequirement, LyciumRequirementGroup } from "@lycium/contracts";
import type { CourseEntry } from "../../courseTypes";
import { estimateProgramTime, estimateRequirementGroupTime, type TimeEstimate } from "../../utils/curriculumTime";
import {
  catalogPathProgress,
  groupCourseIds,
  programCourseIds,
  type CatalogPathProgress,
  type CatalogProgressCache,
} from "./catalogProgramProgress";
import { type CatalogPathSortMode, normalizeSearchText } from "./catalogUtils";
import { scoreWeightedSearch } from "../../utils/weightedSearch";

export type CatalogVisibleProgram = {
  program: LyciumProgram;
  estimate: TimeEstimate;
  progress: CatalogPathProgress;
  searchScore: number;
};

export type CatalogVisibleCluster = {
  cluster: LyciumRequirementGroup;
  courseIds: string[];
  estimate: TimeEstimate;
  progress: CatalogPathProgress;
  searchScore: number;
};

type VisibleProgramOptions = {
  programs: LyciumProgram[];
  courses: CourseEntry[];
  courseMap: Map<string, CourseEntry>;
  progressCache?: CatalogProgressCache;
  searchQuery: string;
  sortMode: CatalogPathSortMode;
};

type VisibleClusterOptions = {
  program: LyciumProgram | null;
  courseMap: Map<string, CourseEntry>;
  progressCache?: CatalogProgressCache;
  searchQuery: string;
  sortMode: CatalogPathSortMode;
};

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function requirementSearchText(requirement: LyciumRequirement): Array<string | undefined> {
  const requirementMeta = requirement as { title?: unknown; description?: unknown };
  const ownText = [
    requirement.id,
    optionalString(requirementMeta.title),
    optionalString(requirementMeta.description),
  ];

  if (requirement.type === "requirement_set") {
    return [...ownText, ...requirement.requirements.flatMap(requirementSearchText)];
  }

  return ownText;
}

function programSearchScore(program: LyciumProgram, query: string): number {
  const outcomeText = program.learningOutcomes.map((outcome) => outcome.statement);
  const groupText = program.requirementGroups.flatMap((group) => [group.displayName, group.purpose, group.groupKind]);

  return scoreWeightedSearch(
    [
      { values: [program.title], weight: 10 },
      { values: [program.field], weight: 8 },
      { values: [program.programType], weight: 6 },
      { values: [program.level], weight: 5 },
      { values: [program.description, program.targetOutcome, ...outcomeText], weight: 3 },
      { values: groupText, weight: 2 },
    ],
    query,
  );
}

function clusterSearchScore(cluster: LyciumRequirementGroup, query: string): number {
  const outcomeText = cluster.learningOutcomes.map((outcome) => outcome.statement);
  const requirementText = cluster.requirements.flatMap(requirementSearchText);

  return scoreWeightedSearch(
    [
      { values: [cluster.displayName], weight: 10 },
      { values: [cluster.groupKind], weight: 6 },
      { values: [cluster.purpose], weight: 4 },
      { values: outcomeText, weight: 3 },
      { values: requirementText, weight: 2 },
    ],
    query,
  );
}

function compareTitles(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

function compareByPathSort(
  a: { title: string; estimate: TimeEstimate; progress: CatalogPathProgress },
  b: { title: string; estimate: TimeEstimate; progress: CatalogPathProgress },
  sortMode: CatalogPathSortMode,
): number {
  if (sortMode === "completion-desc") return b.progress.percentage - a.progress.percentage || compareTitles(a.title, b.title);
  if (sortMode === "completion-asc") return a.progress.percentage - b.progress.percentage || compareTitles(a.title, b.title);
  if (sortMode === "time-desc") return (b.estimate.minutes ?? -1) - (a.estimate.minutes ?? -1) || compareTitles(a.title, b.title);
  if (sortMode === "time-asc") return (a.estimate.minutes ?? Number.MAX_SAFE_INTEGER) - (b.estimate.minutes ?? Number.MAX_SAFE_INTEGER) || compareTitles(a.title, b.title);
  return compareTitles(a.title, b.title);
}

export function getVisibleCatalogPrograms({
  programs,
  courses,
  courseMap,
  progressCache,
  searchQuery,
  sortMode,
}: VisibleProgramOptions): CatalogVisibleProgram[] {
  const query = normalizeSearchText(searchQuery);

  return programs
    .map((program) => ({
      program,
      estimate: estimateProgramTime(program, courses),
      progress: catalogPathProgress(programCourseIds(program), courseMap, progressCache),
      searchScore: programSearchScore(program, query),
    }))
    .filter(({ searchScore }) => !query || searchScore > 0)
    .sort((a, b) => {
      if (query) return b.searchScore - a.searchScore || compareByPathSort({ title: a.program.title, ...a }, { title: b.program.title, ...b }, sortMode);
      return compareByPathSort({ title: a.program.title, ...a }, { title: b.program.title, ...b }, sortMode);
    });
}

export function getVisibleCatalogClusters({
  program,
  courseMap,
  progressCache,
  searchQuery,
  sortMode,
}: VisibleClusterOptions): CatalogVisibleCluster[] {
  const query = normalizeSearchText(searchQuery);

  return (program?.requirementGroups ?? [])
    .map((cluster) => {
      const courseIds = groupCourseIds(cluster);

      return {
        cluster,
        courseIds,
        estimate: estimateRequirementGroupTime(cluster, courseMap),
        progress: catalogPathProgress(courseIds, courseMap, progressCache),
        searchScore: clusterSearchScore(cluster, query),
      };
    })
    .filter(({ searchScore }) => !query || searchScore > 0)
    .sort((a, b) => {
      if (query) return b.searchScore - a.searchScore || compareByPathSort({ title: a.cluster.displayName, ...a }, { title: b.cluster.displayName, ...b }, sortMode);
      return compareByPathSort({ title: a.cluster.displayName, ...a }, { title: b.cluster.displayName, ...b }, sortMode);
    });
}

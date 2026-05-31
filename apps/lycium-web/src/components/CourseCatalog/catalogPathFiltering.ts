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

function scoreText(value: string | undefined, query: string, weight: number): number {
  const searchable = value?.toLowerCase() ?? "";

  if (!query || !searchable) return 0;
  if (searchable === query) return weight * 4;
  if (searchable.startsWith(query)) return weight * 3;
  if (searchable.includes(query)) return weight * 2;
  return 0;
}

function scoreTextList(values: Array<string | undefined>, query: string, weight: number): number {
  return values.reduce((total, value) => total + scoreText(value, query, weight), 0);
}

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

  return (
    scoreText(program.title, query, 10) +
    scoreText(program.field, query, 8) +
    scoreText(program.programType, query, 6) +
    scoreText(program.level, query, 5) +
    scoreText(program.description, query, 3) +
    scoreText(program.targetOutcome, query, 3) +
    scoreTextList(outcomeText, query, 3) +
    scoreTextList(groupText, query, 2)
  );
}

function clusterSearchScore(cluster: LyciumRequirementGroup, query: string): number {
  const outcomeText = cluster.learningOutcomes.map((outcome) => outcome.statement);
  const requirementText = cluster.requirements.flatMap(requirementSearchText);

  return (
    scoreText(cluster.displayName, query, 10) +
    scoreText(cluster.groupKind, query, 6) +
    scoreText(cluster.purpose, query, 4) +
    scoreTextList(outcomeText, query, 3) +
    scoreTextList(requirementText, query, 2)
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

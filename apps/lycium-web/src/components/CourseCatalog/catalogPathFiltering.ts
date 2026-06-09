import type { LyciumProgram, LyciumRequirement, LyciumRequirementGroup } from "@lycium/contracts";
import type { CourseEntry } from "../../courseTypes";
import { estimateProgramTime, estimateRequirementGroupTime, type TimeEstimate } from "../../utils/curriculumTime";
import {
  catalogGroupRollupProgress,
  catalogProgramRollupProgress,
  groupPathContinuity,
  groupCourseIds,
  programPathContinuity,
  programCourseIds,
  type CatalogPathContinuity,
  type CatalogPathProgress,
  type CatalogProgressCache,
} from "./catalogProgramProgress";
import { type CatalogActivityFilter, type CatalogPathSortMode, normalizeSearchText } from "./catalogUtils";
import { scoreWeightedSearch } from "../../utils/weightedSearch";
import { getUnmetCoursePrerequisites } from "./catalogPrerequisites";
import { summarizeCatalogPathReadiness, type CatalogPathReadiness } from "./catalogPathReadiness";

export type CatalogVisibleProgram = {
  program: LyciumProgram;
  estimate: TimeEstimate;
  progress: CatalogPathProgress;
  continuity: CatalogPathContinuity;
  readiness: CatalogPathReadiness;
  searchScore: number;
};

export type CatalogVisibleCluster = {
  cluster: LyciumRequirementGroup;
  courseIds: string[];
  estimate: TimeEstimate;
  progress: CatalogPathProgress;
  continuity: CatalogPathContinuity;
  readiness: CatalogPathReadiness;
  searchScore: number;
};

type VisibleProgramOptions = {
  programs: LyciumProgram[];
  courses: CourseEntry[];
  courseMap: Map<string, CourseEntry>;
  progressCache?: CatalogProgressCache;
  activityFilter: CatalogActivityFilter;
  collegeFilter: string;
  departmentFilter: string;
  difficultyFilter: string;
  searchQuery: string;
  showLockedCourses: boolean;
  sortMode: CatalogPathSortMode;
};

type VisibleClusterOptions = {
  program: LyciumProgram | null;
  courseMap: Map<string, CourseEntry>;
  progressCache?: CatalogProgressCache;
  activityFilter: CatalogActivityFilter;
  collegeFilter: string;
  departmentFilter: string;
  difficultyFilter: string;
  searchQuery: string;
  showLockedCourses: boolean;
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

function pathCourses(courseIds: string[], courseMap: Map<string, CourseEntry>): CourseEntry[] {
  return Array.from(new Set(courseIds))
    .map((courseId) => courseMap.get(courseId))
    .filter((course): course is CourseEntry => Boolean(course));
}

function courseHasActivity(course: CourseEntry, progressCache?: CatalogProgressCache): boolean {
  const progress = progressCache?.get(course.key);
  return Boolean(progress && (progress.viewed > 0 || progress.completed > 0));
}

function courseIsLocked(course: CourseEntry, courseMap: Map<string, CourseEntry>, progressCache?: CatalogProgressCache): boolean {
  return !courseHasActivity(course, progressCache) && getUnmetCoursePrerequisites(course, courseMap).length > 0;
}

function pathMatchesFilters(
  courses: CourseEntry[],
  progress: CatalogPathProgress,
  {
    activityFilter,
    collegeFilter,
    courseMap,
    departmentFilter,
    difficultyFilter,
    progressCache,
    showLockedCourses,
  }: {
    activityFilter: CatalogActivityFilter;
    collegeFilter: string;
    courseMap: Map<string, CourseEntry>;
    departmentFilter: string;
    difficultyFilter: string;
    progressCache?: CatalogProgressCache;
    showLockedCourses: boolean;
  },
): boolean {
  const matchesCollege = collegeFilter === "all" || courses.some((course) => course.data.category === collegeFilter);
  const matchesDepartment = departmentFilter === "all" || courses.some((course) => course.data.department === departmentFilter);
  const matchesDifficulty = difficultyFilter === "all" || courses.some((course) => course.data.difficultyLevel === difficultyFilter);
  const matchesAvailability = showLockedCourses || courses.some((course) => !courseIsLocked(course, courseMap, progressCache));
  const matchesActivity =
    activityFilter === "all" ||
    (activityFilter === "not-started" && !progress.hasProgress) ||
    (activityFilter === "in-progress" && progress.hasProgress && progress.percentage < 100) ||
    (activityFilter === "completed" && progress.percentage >= 100);

  return matchesCollege && matchesDepartment && matchesDifficulty && matchesAvailability && matchesActivity;
}

export function getVisibleCatalogPrograms({
  programs,
  courses,
  courseMap,
  progressCache,
  activityFilter,
  collegeFilter,
  departmentFilter,
  difficultyFilter,
  searchQuery,
  showLockedCourses,
  sortMode,
}: VisibleProgramOptions): CatalogVisibleProgram[] {
  const query = normalizeSearchText(searchQuery);

  return programs
    .map((program) => {
      const courseIds = programCourseIds(program);
      const progress = catalogProgramRollupProgress(program, courseMap, progressCache);
      return {
        program,
        estimate: estimateProgramTime(program, courses),
        progress,
        continuity: programPathContinuity(program, courseMap, progressCache),
        readiness: summarizeCatalogPathReadiness(
          program.requirementGroups.flatMap((group) => group.requirements),
          courseIds,
          courseMap,
          progressCache,
        ),
        searchScore: programSearchScore(program, query),
        pathCourses: pathCourses(courseIds, courseMap),
      };
    })
    .filter(({ pathCourses, progress, searchScore }) => {
      const matchesSearch = !query || searchScore > 0;
      return matchesSearch && pathMatchesFilters(pathCourses, progress, {
        activityFilter,
        collegeFilter,
        courseMap,
        departmentFilter,
        difficultyFilter,
        progressCache,
        showLockedCourses,
      });
    })
    .sort((a, b) => {
      if (query) return b.searchScore - a.searchScore || compareByPathSort({ title: a.program.title, ...a }, { title: b.program.title, ...b }, sortMode);
      return compareByPathSort({ title: a.program.title, ...a }, { title: b.program.title, ...b }, sortMode);
    });
}

export function getVisibleCatalogClusters({
  program,
  courseMap,
  progressCache,
  activityFilter,
  collegeFilter,
  departmentFilter,
  difficultyFilter,
  searchQuery,
  showLockedCourses,
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
        progress: catalogGroupRollupProgress(cluster, courseMap, progressCache),
        continuity: groupPathContinuity(cluster, courseMap, progressCache),
        readiness: summarizeCatalogPathReadiness(cluster.requirements, courseIds, courseMap, progressCache),
        searchScore: clusterSearchScore(cluster, query),
        pathCourses: pathCourses(courseIds, courseMap),
      };
    })
    .filter(({ pathCourses, progress, searchScore }) => {
      const matchesSearch = !query || searchScore > 0;
      return matchesSearch && pathMatchesFilters(pathCourses, progress, {
        activityFilter,
        collegeFilter,
        courseMap,
        departmentFilter,
        difficultyFilter,
        progressCache,
        showLockedCourses,
      });
    })
    .sort((a, b) => {
      if (query) return b.searchScore - a.searchScore || compareByPathSort({ title: a.cluster.displayName, ...a }, { title: b.cluster.displayName, ...b }, sortMode);
      return compareByPathSort({ title: a.cluster.displayName, ...a }, { title: b.cluster.displayName, ...b }, sortMode);
    });
}

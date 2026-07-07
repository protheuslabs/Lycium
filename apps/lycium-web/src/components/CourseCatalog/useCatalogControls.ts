import { useMemo, useReducer, useState } from "react";
import type { LyciumProgram, LyciumRequirementGroup } from "@lycium/contracts";
import type { CourseEntry } from "../../courseTypes";
import { getCourseCategoryDepartments, getCourseCategoryLabel } from "../../courseData/courseTaxonomy";
import { getVisibleCatalogCourses } from "./catalogCourseFiltering";
import { getVisibleCatalogClusters, getVisibleCatalogPrograms } from "./catalogPathFiltering";
import { buildCatalogProgressCache, groupCourseIds } from "./catalogProgramProgress";
import { groupCourseRequirementContexts } from "./catalogRequirementContext";
import {
  type CatalogActivityFilter,
  type CatalogPathSortMode,
  type CatalogSortMode,
  type CatalogViewLevel,
  getCollegeFilterLabel,
} from "./catalogUtils";
import type { CatalogSelectionMode } from "../../utils/catalogSelection";

type CatalogControlsOptions = {
  courses: CourseEntry[];
  programs: LyciumProgram[];
  catalogView: "programs" | "courses" | null;
  catalogProgramId: string | null;
  catalogClusterId: string | null;
  onCatalogDrilldown: (
    viewLevel: CatalogViewLevel,
    program?: LyciumProgram | null,
    cluster?: LyciumRequirementGroup | null,
  ) => void;
  selectionMode: CatalogSelectionMode;
};

type CatalogNavigationState = {
  routeKey: string;
  catalogViewLevel: CatalogViewLevel;
  selectedProgramId: string;
  selectedClusterId: string;
  catalogPage: number;
};

type CatalogNavigationAction = {
  routeKey: string;
  base: CatalogNavigationState;
  patch: Partial<Omit<CatalogNavigationState, "routeKey">>;
};

function navigationFromRoute(
  catalogView: CatalogControlsOptions["catalogView"],
  catalogProgramId: string | null,
  catalogClusterId: string | null,
  fallbackProgramId: string,
): CatalogNavigationState {
  return {
    routeKey: [catalogView ?? "", catalogProgramId ?? "", catalogClusterId ?? ""].join(":"),
    catalogViewLevel: catalogProgramId ? (catalogClusterId ? "courses" : "clusters") : catalogView ?? "courses",
    selectedProgramId: catalogProgramId ?? fallbackProgramId,
    selectedClusterId: catalogProgramId ? catalogClusterId ?? "" : "",
    catalogPage: 1,
  };
}

function catalogNavigationReducer(
  state: CatalogNavigationState,
  action: CatalogNavigationAction,
): CatalogNavigationState {
  const current = state.routeKey === action.routeKey ? state : action.base;
  return { ...current, ...action.patch, routeKey: action.routeKey };
}

function courseMapAliases(course: CourseEntry): string[] {
  const aliases = new Set<string>([course.key]);
  if (course.snapshotId !== undefined) aliases.add(`remote-${course.snapshotId}`);
  const metadata = course.data.metadata && typeof course.data.metadata === "object"
    ? course.data.metadata as Record<string, unknown>
    : {};
  for (const key of ["scaffoldCourseId", "courseId", "programCourseId", "requirementCourseId", "linkedExistingCourseId"]) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) aliases.add(value);
  }
  return Array.from(aliases);
}

export function buildCatalogCourseMap(courses: CourseEntry[]): Map<string, CourseEntry> {
  const map = new Map<string, CourseEntry>();
  for (const course of courses) {
    for (const alias of courseMapAliases(course)) {
      if (!map.has(alias)) map.set(alias, course);
    }
  }
  return map;
}

export function useCatalogControls({
  courses,
  programs,
  catalogView,
  catalogProgramId,
  catalogClusterId,
  onCatalogDrilldown,
  selectionMode,
}: CatalogControlsOptions) {
  const routeNavigation = navigationFromRoute(catalogView, catalogProgramId, catalogClusterId, programs[0]?.id ?? "");
  const [navigationState, dispatchNavigation] = useReducer(catalogNavigationReducer, routeNavigation);
  const navigation = navigationState.routeKey === routeNavigation.routeKey ? navigationState : routeNavigation;
  const { catalogPage, selectedClusterId, selectedProgramId } = navigation;
  const updateNavigation = (patch: CatalogNavigationAction["patch"]) =>
    dispatchNavigation({ routeKey: routeNavigation.routeKey, base: navigation, patch });
  const setCatalogViewLevel = (catalogViewLevel: CatalogViewLevel) => updateNavigation({ catalogViewLevel });
  const setSelectedProgramId = (nextProgramId: string) => updateNavigation({ selectedProgramId: nextProgramId });
  const setSelectedClusterId = (nextClusterId: string) => updateNavigation({ selectedClusterId: nextClusterId });
  const setCatalogPage = (nextPage: number) => updateNavigation({ catalogPage: nextPage });
  const [searchQuery, setSearchQuery] = useState("");
  const [collegeFilter, setCollegeFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [difficultyFilter, setDifficultyFilter] = useState("all");
  const [activityFilter, setActivityFilter] = useState<CatalogActivityFilter>("all");
  const [showLockedCourses, setShowLockedCourses] = useState(true);
  const [sortMode, setSortMode] = useState<CatalogSortMode>("college");
  const [pathSortMode, setPathSortMode] = useState<CatalogPathSortMode>("name");
  const catalogViewLevel =
    selectionMode?.kind === "program"
      ? "clusters"
      : selectionMode?.kind === "cluster"
        ? "courses"
        : navigation.catalogViewLevel;

  const selectedProgram = useMemo(
    () => programs.find((program) => program.id === selectedProgramId) ?? programs[0] ?? null,
    [programs, selectedProgramId],
  );
  const selectedCluster = useMemo(
    () => selectedProgram?.requirementGroups.find((group) => group.id === selectedClusterId) ?? null,
    [selectedClusterId, selectedProgram],
  );
  const selectedClusterCourseIds = useMemo(
    () => new Set(selectedCluster ? groupCourseIds(selectedCluster) : []),
    [selectedCluster],
  );
  const selectedClusterRequirementContexts = useMemo(
    () => groupCourseRequirementContexts(selectedCluster),
    [selectedCluster],
  );
  const catalogCourseMap = useMemo(() => buildCatalogCourseMap(courses), [courses]);
  const catalogProgressCache = useMemo(() => buildCatalogProgressCache(catalogCourseMap), [catalogCourseMap]);
  const programOptions = useMemo(
    () => programs.map((program) => ({ value: program.id, label: program.title })),
    [programs],
  );

  const collegeFilterOptions = useMemo(() => {
    const categories = new Map<string, string>();

    for (const course of courses) {
      if (course.data.category) {
        categories.set(course.data.category, getCourseCategoryLabel(course.data.category));
      }
    }

    return [
      { value: "all", label: "All colleges" },
      ...Array.from(categories, ([value, label]) => ({ value, label: getCollegeFilterLabel(label) })).sort((a, b) =>
        a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
      ),
    ];
  }, [courses]);

  const departmentFilterOptions = useMemo(() => {
    if (collegeFilter === "all") {
      return [{ value: "all", label: "Select a college first", disabled: true }];
    }

    return [
      { value: "all", label: "All departments" },
      ...getCourseCategoryDepartments(collegeFilter).map((department) => ({
        value: department.id,
        label: department.label,
      })),
    ];
  }, [collegeFilter]);

  const difficultyFilterOptions = useMemo(() => {
    const difficulties = Array.from(
      new Set(courses.map((course) => course.data.difficultyLevel).filter((level): level is string => Boolean(level))),
    ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

    return [{ value: "all", label: "Any difficulty" }, ...difficulties.map((difficulty) => ({ value: difficulty, label: difficulty }))];
  }, [courses]);

  const activeFilterCount = [
    !showLockedCourses,
    collegeFilter !== "all",
    departmentFilter !== "all",
    difficultyFilter !== "all",
    activityFilter !== "all",
  ].filter(Boolean).length;

  const visibleCourses = useMemo(
    () =>
      getVisibleCatalogCourses({
        activityFilter,
        catalogCourseMap,
        collegeFilter,
        courses,
        departmentFilter,
        difficultyFilter,
        isClusterScoped: selectionMode?.kind !== "cluster" && Boolean(selectedCluster),
        searchQuery,
        selectedClusterCourseIds,
        selectedClusterRequirementContexts,
        showLockedCourses,
        sortMode,
      }),
    [
      activityFilter,
      catalogCourseMap,
      collegeFilter,
      courses,
      departmentFilter,
      difficultyFilter,
      searchQuery,
      selectionMode,
      selectedCluster,
      selectedClusterCourseIds,
      selectedClusterRequirementContexts,
      showLockedCourses,
      sortMode,
    ],
  );
  const visiblePrograms = useMemo(
    () =>
      getVisibleCatalogPrograms({
        programs,
        courses,
        courseMap: catalogCourseMap,
        progressCache: catalogProgressCache,
        activityFilter,
        collegeFilter,
        departmentFilter,
        difficultyFilter,
        searchQuery,
        showLockedCourses,
        sortMode: pathSortMode,
      }),
    [activityFilter, catalogCourseMap, catalogProgressCache, collegeFilter, courses, departmentFilter, difficultyFilter, pathSortMode, programs, searchQuery, showLockedCourses],
  );
  const visibleClusters = useMemo(
    () =>
      getVisibleCatalogClusters({
        program: selectionMode?.kind === "program" ? null : selectedProgram,
        programs: selectionMode?.kind === "program" ? programs : undefined,
        courseMap: catalogCourseMap,
        progressCache: catalogProgressCache,
        activityFilter,
        collegeFilter,
        departmentFilter,
        difficultyFilter,
        searchQuery,
        showLockedCourses,
        sortMode: pathSortMode,
      }),
    [activityFilter, catalogCourseMap, catalogProgressCache, collegeFilter, departmentFilter, difficultyFilter, pathSortMode, programs, searchQuery, selectedProgram, selectionMode, showLockedCourses],
  );

  const resetCatalogPage = () => setCatalogPage(1);
  const setCourseFilter = (action: () => void) => {
    action();
    resetCatalogPage();
  };

  const handleSearchQueryChange = (value: string) => setCourseFilter(() => setSearchQuery(value));
  const handlePrerequisiteSearch = (value: string) => {
    setSearchQuery(value);
    setCatalogViewLevel("courses");
    setSelectedClusterId("");
    setShowLockedCourses(true);
    setCollegeFilter("all");
    setDepartmentFilter("all");
    setDifficultyFilter("all");
    setActivityFilter("all");
    setCatalogPage(1);
    onCatalogDrilldown("courses");
  };
  const handleCollegeFilterChange = (value: string) =>
    setCourseFilter(() => {
      setCollegeFilter(value);
      setDepartmentFilter("all");
    });
  const handleDepartmentFilterChange = (value: string) => setCourseFilter(() => setDepartmentFilter(value));
  const handleDifficultyFilterChange = (value: string) => setCourseFilter(() => setDifficultyFilter(value));
  const handleActivityFilterChange = (value: string) => setCourseFilter(() => setActivityFilter(value as CatalogActivityFilter));
  const handleShowLockedCoursesChange = (checked: boolean) => setCourseFilter(() => setShowLockedCourses(checked));
  const handleSortModeChange = (value: string) => setCourseFilter(() => setSortMode(value as CatalogSortMode));
  const handlePathSortModeChange = (value: string) => setCourseFilter(() => setPathSortMode(value as CatalogPathSortMode));

  const handleResetCatalogFilters = () =>
    setCourseFilter(() => {
      setShowLockedCourses(true);
      setCollegeFilter("all");
      setDepartmentFilter("all");
      setDifficultyFilter("all");
      setActivityFilter("all");
    });

  const handleSelectedProgramChange = (value: string) => {
    const program = programs.find((candidate) => candidate.id === value) ?? programs[0] ?? null;
    setSelectedProgramId(program?.id ?? "");
    setSelectedClusterId("");
    setCatalogPage(1);
    onCatalogDrilldown("clusters", program);
  };

  const handleCatalogViewLevelChange = (value: string) => {
    const nextLevel = value as CatalogViewLevel;
    setCatalogViewLevel(nextLevel);
    setCatalogPage(1);
    if (nextLevel === "programs") {
      setSelectedClusterId("");
      onCatalogDrilldown("programs");
      return;
    }
    if (nextLevel === "clusters") {
      const program = selectedProgram ?? programs[0] ?? null;
      setSelectedProgramId(program?.id ?? "");
      setSelectedClusterId("");
      onCatalogDrilldown("clusters", program);
      return;
    }
    setSelectedClusterId("");
    onCatalogDrilldown("courses");
  };

  const handleProgramSelect = (program: LyciumProgram) => {
    setSelectedProgramId(program.id);
    setSelectedClusterId("");
    setCatalogViewLevel("clusters");
    setCatalogPage(1);
    onCatalogDrilldown("clusters", program);
  };

  const handleClusterSelect = (cluster: LyciumRequirementGroup, program?: LyciumProgram | null) => {
    setSelectedClusterId(cluster.id);
    setCatalogViewLevel("courses");
    setCatalogPage(1);
    onCatalogDrilldown("courses", program ?? selectedProgram, cluster);
  };

  return {
    activeFilterCount,
    activityFilter,
    catalogCourseMap,
    catalogPage,
    catalogProgressCache,
    catalogViewLevel,
    collegeFilter,
    collegeFilterOptions,
    departmentFilter,
    departmentFilterOptions,
    difficultyFilter,
    difficultyFilterOptions,
    handleActivityFilterChange,
    handleCatalogViewLevelChange,
    handleClusterSelect,
    handleCollegeFilterChange,
    handleDepartmentFilterChange,
    handleDifficultyFilterChange,
    handlePathSortModeChange,
    handlePrerequisiteSearch,
    handleProgramSelect,
    handleResetCatalogFilters,
    handleSearchQueryChange,
    handleSelectedProgramChange,
    handleShowLockedCoursesChange,
    handleSortModeChange,
    pathSortMode,
    programOptions,
    searchQuery,
    selectedCluster,
    selectedProgram,
    selectedProgramId,
    setCatalogPage,
    showLockedCourses,
    sortMode,
    visibleClusters,
    visibleCourses,
    visiblePrograms,
  };
}

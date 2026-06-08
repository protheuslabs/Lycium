import { useEffect, useMemo, useState } from "react";
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
};

export function useCatalogControls({
  courses,
  programs,
  catalogView,
  catalogProgramId,
  catalogClusterId,
  onCatalogDrilldown,
}: CatalogControlsOptions) {
  const [catalogViewLevel, setCatalogViewLevel] = useState<CatalogViewLevel>("courses");
  const [selectedProgramId, setSelectedProgramId] = useState(programs[0]?.id ?? "");
  const [selectedClusterId, setSelectedClusterId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [collegeFilter, setCollegeFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [difficultyFilter, setDifficultyFilter] = useState("all");
  const [activityFilter, setActivityFilter] = useState<CatalogActivityFilter>("all");
  const [showLockedCourses, setShowLockedCourses] = useState(true);
  const [sortMode, setSortMode] = useState<CatalogSortMode>("college");
  const [pathSortMode, setPathSortMode] = useState<CatalogPathSortMode>("name");
  const [catalogPage, setCatalogPage] = useState(1);

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
  const catalogCourseMap = useMemo(() => new Map(courses.map((course) => [course.key, course])), [courses]);
  const catalogProgressCache = useMemo(() => buildCatalogProgressCache(catalogCourseMap), [catalogCourseMap]);
  const programOptions = useMemo(
    () => programs.map((program) => ({ value: program.id, label: program.title })),
    [programs],
  );

  useEffect(() => {
    if (catalogProgramId) {
      setSelectedProgramId(catalogProgramId);
      setSelectedClusterId(catalogClusterId ?? "");
      setCatalogViewLevel(catalogClusterId ? "courses" : "clusters");
      setCatalogPage(1);
      return;
    }

    setSelectedClusterId("");
    setCatalogViewLevel(catalogView ?? "courses");
    setCatalogPage(1);
  }, [catalogClusterId, catalogProgramId, catalogView]);

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
        isClusterScoped: Boolean(selectedCluster),
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
        program: selectedProgram,
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
    [activityFilter, catalogCourseMap, catalogProgressCache, collegeFilter, departmentFilter, difficultyFilter, pathSortMode, searchQuery, selectedProgram, showLockedCourses],
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

  const handleClusterSelect = (cluster: LyciumRequirementGroup) => {
    setSelectedClusterId(cluster.id);
    setCatalogViewLevel("courses");
    setCatalogPage(1);
    onCatalogDrilldown("courses", selectedProgram, cluster);
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

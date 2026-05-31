import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent, MouseEvent } from "react";
import type { LyciumProgram, LyciumRequirement, LyciumRequirementGroup } from "@lycium/contracts";
import CatalogFooter from "../CatalogFooter/CatalogFooter";
import Dropdown from "../Dropdown/Dropdown";
import type { CourseEntry } from "../../courseTypes";
import { courseCategories, getCourseCategoryDepartments, getCourseCategoryLabel } from "../../courseData/courseTaxonomy";
import { getBookmarkedModuleSection, getCourseProgress } from "../../utils/courseRouting";
import { estimateProgramTime, estimateRequirementGroupTime, formatTimeEstimate, timeEstimateSourceLabel } from "../../utils/curriculumTime";
import CatalogCourseCard from "./CatalogCourseCard";
import CatalogPagination from "./CatalogPagination";
import CourseInfoModal from "./CourseInfoModal";
import CreateCourseModal from "./CreateCourseModal";
import {
  CATALOG_COURSE_CARD_MIN_WIDTH,
  CATALOG_DESKTOP_ROWS_PER_PAGE,
  CATALOG_LEVEL_OPTIONS,
  CATALOG_MOBILE_ROWS_PER_PAGE,
  CATALOG_SORT_OPTIONS,
  type CatalogSortMode,
  compareCatalogSort,
  getCollegeFilterLabel,
  getCourseSearchScore,
  getGeneratingCourseTitle,
  normalizeSearchText,
} from "./catalogUtils";

type CourseCatalogProps = {
  courses: CourseEntry[];
  programs: LyciumProgram[];
  catalogView: "programs" | "courses" | null;
  catalogProgramId: string | null;
  catalogClusterId: string | null;
  prompt: string;
  level: string;
  canCreateCourse: boolean;
  generateStatus: "idle" | "loading" | "error" | "success";
  generateMessage: string;
  onPromptChange: (value: string) => void;
  onLevelChange: (value: string) => void;
  onGenerateCourse: (
    event: FormEvent<HTMLFormElement>,
    sourceLinks: string[],
    classification: { category: string; department: string },
  ) => void;
  onOpenCourse: (course: CourseEntry) => void;
  onOpenProgram: (program: LyciumProgram) => void;
  onCatalogDrilldown: (
    viewLevel: CatalogViewLevel,
    program?: LyciumProgram | null,
    cluster?: LyciumRequirementGroup | null,
  ) => void;
  onPublishCourse: (course: CourseEntry) => void;
  publishingCourseKey: string | null;
  onOpenSettings: (event: MouseEvent<HTMLAnchorElement>) => void;
};

type CatalogViewLevel = "programs" | "clusters" | "courses";
type CatalogActivityFilter = "all" | "not-started" | "in-progress" | "completed";

type CatalogPathProgress = {
  total: number;
  completed: number;
  viewed: number;
  percentage: number;
  viewedPercentage: number;
  hasProgress: boolean;
};

const CATALOG_VIEW_LEVEL_OPTIONS = [
  { value: "programs", label: "Programs" },
  { value: "clusters", label: "Clusters" },
  { value: "courses", label: "Courses" },
];

const CATALOG_ACTIVITY_OPTIONS = [
  { value: "all", label: "Any progress" },
  { value: "not-started", label: "Not started" },
  { value: "in-progress", label: "In progress" },
  { value: "completed", label: "Completed" },
];

function requirementCourseIds(requirement: LyciumRequirement): string[] {
  if (requirement.type === "complete_course") return [requirement.courseId];
  if (requirement.type === "complete_n_of_courses") return requirement.courseIds;
  if (requirement.type === "requirement_set") return requirement.requirements.flatMap(requirementCourseIds);
  return [];
}

function groupCourseIds(group: LyciumRequirementGroup): string[] {
  return Array.from(new Set(group.requirements.flatMap(requirementCourseIds)));
}

function catalogPathProgress(courseIds: string[], courseMap: Map<string, CourseEntry>): CatalogPathProgress {
  const uniqueCourseIds = Array.from(new Set(courseIds));
  const courses = uniqueCourseIds.map((courseId) => courseMap.get(courseId)).filter((course): course is CourseEntry => Boolean(course));
  const total = courses.length;

  if (total === 0) {
    return { total: 0, completed: 0, viewed: 0, percentage: 0, viewedPercentage: 0, hasProgress: false };
  }

  const summaries = courses.map(getCourseProgress);
  const completed = summaries.filter((summary) => summary.percentage >= 100).length;
  const viewed = summaries.filter((summary) => summary.viewed > 0 || summary.completed > 0).length;

  return {
    total,
    completed,
    viewed,
    percentage: (completed / total) * 100,
    viewedPercentage: (viewed / total) * 100,
    hasProgress: viewed > 0 || completed > 0,
  };
}

function programCourseIds(program: LyciumProgram): string[] {
  return Array.from(new Set(program.requirementGroups.flatMap(groupCourseIds)));
}

type CoursePrerequisiteLike = NonNullable<CourseEntry["data"]["prerequisites"]>[number] | string;

function getPrerequisiteCourseId(prerequisite: CoursePrerequisiteLike): string | null {
  if (typeof prerequisite === "string") {
    return prerequisite;
  }

  if (prerequisite.type !== "course") {
    return null;
  }

  return prerequisite.courseId ?? prerequisite.id ?? null;
}

function getPrerequisiteTitle(prerequisite: CoursePrerequisiteLike, prerequisiteCourse: CourseEntry | undefined): string {
  if (typeof prerequisite === "string") {
    return prerequisiteCourse?.title ?? prerequisite;
  }

  return prerequisite.title ?? prerequisiteCourse?.title ?? prerequisite.courseId ?? prerequisite.id ?? "required course";
}

function getUnmetCoursePrerequisites(course: CourseEntry, courseMap: Map<string, CourseEntry>): string[] {
  return (course.data.prerequisites ?? [])
    .map((prerequisite) => {
      const prerequisiteCourseId = getPrerequisiteCourseId(prerequisite);

      if (!prerequisiteCourseId) {
        return null;
      }

      const prerequisiteCourse = courseMap.get(prerequisiteCourseId);
      const prerequisiteProgress = prerequisiteCourse ? getCourseProgress(prerequisiteCourse) : null;
      const isMet = Boolean(prerequisiteProgress && prerequisiteProgress.percentage >= 100);

      return isMet ? null : getPrerequisiteTitle(prerequisite, prerequisiteCourse);
    })
    .filter((title): title is string => Boolean(title));
}

export default function CourseCatalog({
  courses,
  programs,
  catalogView,
  catalogProgramId,
  catalogClusterId,
  prompt,
  level,
  canCreateCourse,
  generateStatus,
  generateMessage,
  onPromptChange,
  onLevelChange,
  onGenerateCourse,
  onOpenCourse,
  onOpenProgram,
  onCatalogDrilldown,
  onPublishCourse,
  publishingCourseKey,
  onOpenSettings,
}: CourseCatalogProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [sourceLinks, setSourceLinks] = useState([""]);
  const [infoCourse, setInfoCourse] = useState<CourseEntry | null>(null);
  const [catalogViewLevel, setCatalogViewLevel] = useState<CatalogViewLevel>("courses");
  const [selectedProgramId, setSelectedProgramId] = useState(programs[0]?.id ?? "");
  const [selectedClusterId, setSelectedClusterId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [collegeFilter, setCollegeFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [difficultyFilter, setDifficultyFilter] = useState("all");
  const [activityFilter, setActivityFilter] = useState<CatalogActivityFilter>("all");
  const [showLockedCourses, setShowLockedCourses] = useState(true);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [createCollege, setCreateCollege] = useState("");
  const [createDepartment, setCreateDepartment] = useState("");
  const [sortMode, setSortMode] = useState<CatalogSortMode>("college");
  const [catalogPage, setCatalogPage] = useState(1);
  const [coursesPerPage, setCoursesPerPage] = useState(CATALOG_DESKTOP_ROWS_PER_PAGE - 1);
  const courseGridRef = useRef<HTMLDivElement | null>(null);
  const isGeneratingCourse = generateStatus === "loading";
  const generatingCourseTitle = getGeneratingCourseTitle(prompt);
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
  const catalogCourseMap = useMemo(() => new Map(courses.map((course) => [course.key, course])), [courses]);

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
  const createCollegeOptions = useMemo(
    () => courseCategories.map((category) => ({ value: category.id, label: category.label })),
    [],
  );
  const createDepartmentOptions = useMemo(
    () => getCourseCategoryDepartments(createCollege).map((department) => ({ value: department.id, label: department.label })),
    [createCollege],
  );

  const collegeOptions = useMemo(() => {
    const categories = new Map<string, string>();

    for (const course of courses) {
      if (course.data.category) {
        categories.set(course.data.category, getCourseCategoryLabel(course.data.category));
      }
    }

    return Array.from(categories, ([value, label]) => ({ value, label: getCollegeFilterLabel(label) })).sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { sensitivity: "base" }),
    );
  }, [courses]);

  const collegeFilterOptions = useMemo(
    () => [{ value: "all", label: "All colleges" }, ...collegeOptions],
    [collegeOptions],
  );

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

  const visibleCourses = useMemo(() => {
    const query = normalizeSearchText(searchQuery);

    return courses
      .map((course) => {
        const courseProgress = getCourseProgress(course);
        const bookmarkedSection = getBookmarkedModuleSection(course);
        const hasActiveCoursePage = Boolean(bookmarkedSection);
        const hasCourseActivity = hasActiveCoursePage || courseProgress.viewed > 0 || courseProgress.completed > 0;
        const unmetPrerequisites = getUnmetCoursePrerequisites(course, catalogCourseMap);
        const isLocked = !hasCourseActivity && unmetPrerequisites.length > 0;

        return {
          course,
          courseProgress,
          bookmarkedSection,
          hasCourseActivity,
          isLocked,
          unmetPrerequisites,
          collegeLabel: getCourseCategoryLabel(course.data.category),
          searchScore: getCourseSearchScore(course, query),
        };
      })
      .filter(({ course, courseProgress, hasCourseActivity, isLocked, searchScore }) => {
        const matchesCollege = collegeFilter === "all" || course.data.category === collegeFilter;
        const matchesDepartment = departmentFilter === "all" || course.data.department === departmentFilter;
        const matchesDifficulty = difficultyFilter === "all" || course.data.difficultyLevel === difficultyFilter;
        const matchesCluster = !selectedCluster || selectedClusterCourseIds.has(course.key);
        const matchesSearch = !query || searchScore > 0;
        const matchesAvailability = showLockedCourses || !isLocked;
        const matchesActivity =
          activityFilter === "all" ||
          (activityFilter === "not-started" && !hasCourseActivity) ||
          (activityFilter === "in-progress" && hasCourseActivity && courseProgress.percentage < 100) ||
          (activityFilter === "completed" && courseProgress.percentage >= 100);

        return matchesCollege && matchesDepartment && matchesDifficulty && matchesCluster && matchesSearch && matchesAvailability && matchesActivity;
      })
      .sort((a, b) => {
        if (query) {
          return b.searchScore - a.searchScore || compareCatalogSort(a, b, sortMode);
        }

        return compareCatalogSort(a, b, sortMode);
      });
  }, [
    activityFilter,
    catalogCourseMap,
    collegeFilter,
    courses,
    departmentFilter,
    difficultyFilter,
    searchQuery,
    selectedCluster,
    selectedClusterCourseIds,
    showLockedCourses,
    sortMode,
  ]);

  const totalCatalogPages = Math.max(1, Math.ceil(visibleCourses.length / coursesPerPage));
  const activeCatalogPage = Math.min(catalogPage, totalCatalogPages);
  const catalogPageStartIndex = (activeCatalogPage - 1) * coursesPerPage;
  const catalogPageCourses = visibleCourses.slice(
    catalogPageStartIndex,
    catalogPageStartIndex + coursesPerPage,
  );
  const firstVisibleResult = visibleCourses.length === 0 ? 0 : catalogPageStartIndex + 1;
  const lastVisibleResult = Math.min(catalogPageStartIndex + coursesPerPage, visibleCourses.length);
  const shouldShowCatalogPagination = visibleCourses.length > coursesPerPage;

  useEffect(() => {
    if (catalogViewLevel !== "courses") {
      return;
    }
    const grid = courseGridRef.current;
    if (!grid) {
      return;
    }

    const updateCoursesPerPage = () => {
      const gridWidth = grid.clientWidth;
      const gap = Number.parseFloat(getComputedStyle(grid).columnGap || "0") || 0;
      const columns = Math.max(1, Math.floor((gridWidth + gap) / (CATALOG_COURSE_CARD_MIN_WIDTH + gap)));
      const rowsPerPage = window.matchMedia("(max-width: 860px)").matches
        ? CATALOG_MOBILE_ROWS_PER_PAGE
        : CATALOG_DESKTOP_ROWS_PER_PAGE;
      const leadingCatalogCards = isGeneratingCourse ? 2 : 1;
      const nextCoursesPerPage = Math.max(1, columns * rowsPerPage - leadingCatalogCards);
      setCoursesPerPage(nextCoursesPerPage);
    };

    updateCoursesPerPage();
    const observer = new ResizeObserver(updateCoursesPerPage);
    observer.observe(grid);
    window.addEventListener("resize", updateCoursesPerPage);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateCoursesPerPage);
    };
  }, [catalogViewLevel, isGeneratingCourse]);

  const handleSearchQueryChange = (value: string) => {
    setSearchQuery(value);
    setCatalogPage(1);
  };

  const handleCollegeFilterChange = (value: string) => {
    setCollegeFilter(value);
    setDepartmentFilter("all");
    setCatalogPage(1);
  };

  const handleDepartmentFilterChange = (value: string) => {
    setDepartmentFilter(value);
    setCatalogPage(1);
  };

  const handleDifficultyFilterChange = (value: string) => {
    setDifficultyFilter(value);
    setCatalogPage(1);
  };

  const handleActivityFilterChange = (value: string) => {
    setActivityFilter(value as CatalogActivityFilter);
    setCatalogPage(1);
  };

  const handleShowLockedCoursesChange = (checked: boolean) => {
    setShowLockedCourses(checked);
    setCatalogPage(1);
  };

  const handleResetCatalogFilters = () => {
    setShowLockedCourses(true);
    setCollegeFilter("all");
    setDepartmentFilter("all");
    setDifficultyFilter("all");
    setActivityFilter("all");
    setCatalogPage(1);
  };

  const handleSortModeChange = (value: string) => {
    setSortMode(value as CatalogSortMode);
    setCatalogPage(1);
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

  const handleCreateCollegeChange = (value: string) => {
    setCreateCollege(value);
    setCreateDepartment("");
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

  const handleCreateCardKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setIsCreateModalOpen(true);
    }
  };

  const handleProgramCardKeyDown = (event: KeyboardEvent<HTMLElement>, program: LyciumProgram) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleProgramSelect(program);
    }
  };

  const handleClusterCardKeyDown = (event: KeyboardEvent<HTMLElement>, cluster: LyciumRequirementGroup) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleClusterSelect(cluster);
    }
  };

  const handleSourceLinkChange = (index: number, value: string) => {
    setSourceLinks((currentLinks) => currentLinks.map((link, linkIndex) => (linkIndex === index ? value : link)));
  };

  const handleCreateSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (!canCreateCourse || !createCollege || !createDepartment) {
      event.preventDefault();
      return;
    }

    onGenerateCourse(
      event,
      sourceLinks.map((link) => link.trim()).filter(Boolean),
      { category: createCollege, department: createDepartment },
    );
    setIsCreateModalOpen(false);
  };

  return (
    <div className="catalog-shell">
      <main className="home-page">
        <section className="catalog-page">
          <div className="catalog-toolbar">
            <label className="catalog-view-field">
              <Dropdown
                className="catalog-view-dropdown"
                value={catalogViewLevel}
                options={CATALOG_VIEW_LEVEL_OPTIONS}
                onChange={handleCatalogViewLevelChange}
                ariaLabel="Select catalog view level"
              />
            </label>
            {catalogViewLevel === "courses" ? (
              <>
                <label className="catalog-search-field">
                  <input
                    type="search"
                    placeholder="Search names, tags, and departments"
                    value={searchQuery}
                    onChange={(event) => handleSearchQueryChange(event.target.value)}
                  />
                </label>
                <div className="catalog-dropdown-row">
                  <div className="catalog-filter-shell">
                    <button
                      className={`catalog-filter-button ${isFilterOpen ? "catalog-filter-button--active" : ""}`}
                      type="button"
                      aria-expanded={isFilterOpen}
                      aria-haspopup="dialog"
                      onClick={() => setIsFilterOpen((current) => !current)}
                    >
                      <span>Filters</span>
                      {activeFilterCount > 0 && <span className="catalog-filter-count">{activeFilterCount}</span>}
                    </button>
                    {isFilterOpen && (
                      <div className="catalog-filter-panel" role="dialog" aria-label="Catalog filters">
                        <section className="catalog-filter-section">
                          <div>
                            <h3>Availability</h3>
                            <p>Control whether locked courses appear in the catalog.</p>
                          </div>
                          <label className="catalog-filter-checkbox">
                            <input
                              type="checkbox"
                              checked={showLockedCourses}
                              onChange={(event) => handleShowLockedCoursesChange(event.target.checked)}
                            />
                            <span>Show locked courses</span>
                          </label>
                        </section>
                        <section className="catalog-filter-section">
                          <div>
                            <h3>College and department</h3>
                            <p>Department filtering unlocks after selecting a college.</p>
                          </div>
                          <div className="catalog-filter-grid">
                            <label className="catalog-dropdown-field">
                              <Dropdown
                                className="catalog-dropdown"
                                value={collegeFilter}
                                options={collegeFilterOptions}
                                onChange={handleCollegeFilterChange}
                                ariaLabel="Filter by college"
                              />
                            </label>
                            <label className="catalog-dropdown-field">
                              <Dropdown
                                className="catalog-dropdown"
                                value={departmentFilter}
                                options={departmentFilterOptions}
                                onChange={handleDepartmentFilterChange}
                                ariaLabel="Filter by department"
                                disabled={collegeFilter === "all"}
                              />
                            </label>
                          </div>
                        </section>
                        <section className="catalog-filter-section">
                          <div>
                            <h3>Course state</h3>
                            <p>Narrow by difficulty or how far along the learner is.</p>
                          </div>
                          <div className="catalog-filter-grid">
                            <label className="catalog-dropdown-field">
                              <Dropdown
                                className="catalog-dropdown"
                                value={difficultyFilter}
                                options={difficultyFilterOptions}
                                onChange={handleDifficultyFilterChange}
                                ariaLabel="Filter by difficulty"
                              />
                            </label>
                            <label className="catalog-dropdown-field">
                              <Dropdown
                                className="catalog-dropdown"
                                value={activityFilter}
                                options={CATALOG_ACTIVITY_OPTIONS}
                                onChange={handleActivityFilterChange}
                                ariaLabel="Filter by progress"
                              />
                            </label>
                          </div>
                        </section>
                        <button className="catalog-filter-reset" type="button" onClick={handleResetCatalogFilters}>
                          Reset filters
                        </button>
                      </div>
                    )}
                  </div>
                  <label className="catalog-dropdown-field">
                    <Dropdown
                      className="catalog-dropdown catalog-sort-dropdown"
                      value={sortMode}
                      options={CATALOG_SORT_OPTIONS}
                      onChange={handleSortModeChange}
                      ariaLabel="Sort courses"
                    />
                  </label>
                </div>
              </>
            ) : (
              <div className="catalog-level-context">
                {catalogViewLevel === "clusters" && selectedProgram
                  ? `Viewing clusters in ${selectedProgram.title}`
                  : "Choose a program to view its clusters"}
              </div>
            )}
          </div>

          {catalogViewLevel === "programs" && programs.length > 0 && (
            <section className="program-showcase" aria-label="Learning programs">
              <div className="program-showcase-grid">
                {programs.map((program) => (
                  (() => {
                    const programEstimate = estimateProgramTime(program, courses);
                    const programProgress = catalogPathProgress(programCourseIds(program), catalogCourseMap);
                    return (
                      <article
                        className="program-showcase-card"
                        key={program.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleProgramSelect(program)}
                        onKeyDown={(event) => handleProgramCardKeyDown(event, program)}
                      >
                        <div>
                          <p className="program-showcase-kicker">{program.programType.replace(/_/g, " ")}</p>
                          <h3>{program.title}</h3>
                          <p>{program.description}</p>
                        </div>
                        <div className="program-showcase-meta">
                          <span>{program.requirementGroups.length} clusters</span>
                          <span>{formatTimeEstimate(programEstimate)}</span>
                          <span>{timeEstimateSourceLabel(programEstimate)}</span>
                          <span>{program.reviewStatus}</span>
                        </div>
                        {programProgress.hasProgress && (
                          <div className="program-showcase-progress">
                            <div className="program-showcase-progress-bar">
                              <div className="program-showcase-progress-viewed" style={{ width: `${programProgress.viewedPercentage}%` }} />
                              <div className="program-showcase-progress-complete" style={{ width: `${programProgress.percentage}%` }} />
                            </div>
                            <p>
                              {Math.round(programProgress.percentage)}% complete &middot; {Math.round(programProgress.viewedPercentage)}% viewed
                            </p>
                          </div>
                        )}
                      </article>
                    );
                  })()
                ))}
              </div>
            </section>
          )}

          {catalogViewLevel === "clusters" && selectedProgram && (
            <section className="program-showcase" aria-label={`Clusters in ${selectedProgram.title}`}>
              <div className="program-showcase-grid">
                {selectedProgram.requirementGroups.map((cluster) => {
                  const courseCount = groupCourseIds(cluster).length;
                  const clusterEstimate = estimateRequirementGroupTime(cluster, catalogCourseMap);
                  const clusterProgress = catalogPathProgress(groupCourseIds(cluster), catalogCourseMap);
                  return (
                    <article
                      className="program-showcase-card"
                      key={cluster.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleClusterSelect(cluster)}
                      onKeyDown={(event) => handleClusterCardKeyDown(event, cluster)}
                    >
                      <div>
                        <p className="program-showcase-kicker">{cluster.groupKind.replace(/_/g, " ")}</p>
                        <h3>{cluster.displayName}</h3>
                        <p>{cluster.purpose}</p>
                      </div>
                      <div className="program-showcase-meta">
                        <span>{cluster.requirements.length} requirements</span>
                        <span>{courseCount} courses</span>
                        <span>{formatTimeEstimate(clusterEstimate)}</span>
                        <span>{timeEstimateSourceLabel(clusterEstimate)}</span>
                      </div>
                      {clusterProgress.hasProgress && (
                        <div className="program-showcase-progress">
                          <div className="program-showcase-progress-bar">
                            <div className="program-showcase-progress-viewed" style={{ width: `${clusterProgress.viewedPercentage}%` }} />
                            <div className="program-showcase-progress-complete" style={{ width: `${clusterProgress.percentage}%` }} />
                          </div>
                          <p>
                            {Math.round(clusterProgress.percentage)}% complete &middot; {Math.round(clusterProgress.viewedPercentage)}% viewed
                          </p>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
              <button className="program-open-detail-button" type="button" onClick={() => onOpenProgram(selectedProgram)}>
                Open full program detail
              </button>
            </section>
          )}

          {catalogViewLevel === "courses" && (
            <>
              {selectedCluster && selectedProgram && (
                <div className="catalog-course-scope" aria-live="polite">
                  <span>
                    Courses in {selectedProgram.title} / {selectedCluster.displayName}
                  </span>
                  <button type="button" onClick={() => onCatalogDrilldown("courses")}>
                    Show all courses
                  </button>
                </div>
              )}
              <div className="course-grid" ref={courseGridRef}>
                <article
                  className="course-card create-course-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => setIsCreateModalOpen(true)}
                  onKeyDown={handleCreateCardKeyDown}
                >
                  <div className="create-course-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" focusable="false">
                      <path d="M11 5a1 1 0 1 1 2 0v6h6a1 1 0 1 1 0 2h-6v6a1 1 0 1 1-2 0v-6H5a1 1 0 1 1 0-2h6V5Z" />
                    </svg>
                  </div>
                  <h3>Create Course</h3>
                </article>
                {isGeneratingCourse && (
                  <article className="course-card course-card--generating" aria-live="polite" aria-busy="true">
                    <h3>{generatingCourseTitle}</h3>
                    <div className="generating-course-spinner" aria-hidden="true" />
                    <p className="course-generating-status">{generateMessage || "Course Generating"}</p>
                  </article>
                )}
                {visibleCourses.length === 0 && (
                  <article className="course-card course-card--empty" aria-live="polite">
                    <h3>No matching courses</h3>
                    <p className="course-short-description">Try a different search term, college, or sort option.</p>
                  </article>
                )}
                {catalogPageCourses.map((visibleCourse) => (
                  <CatalogCourseCard
                    key={visibleCourse.course.key}
                    visibleCourse={visibleCourse}
                    onOpenCourse={onOpenCourse}
                    onOpenInfo={setInfoCourse}
                    isPublishing={publishingCourseKey === visibleCourse.course.key}
                  />
                ))}
              </div>
              {shouldShowCatalogPagination && (
                <CatalogPagination
                  activePage={activeCatalogPage}
                  firstVisibleResult={firstVisibleResult}
                  lastVisibleResult={lastVisibleResult}
                  totalPages={totalCatalogPages}
                  totalResults={visibleCourses.length}
                  onPageChange={setCatalogPage}
                />
              )}
            </>
          )}
        </section>
      </main>

      {isCreateModalOpen && (
        <CreateCourseModal
          prompt={prompt}
          level={level}
          sourceLinks={sourceLinks}
          canCreateCourse={canCreateCourse}
          generateStatus={generateStatus}
          generateMessage={generateMessage}
          levelOptions={CATALOG_LEVEL_OPTIONS}
          college={createCollege}
          department={createDepartment}
          collegeOptions={createCollegeOptions}
          departmentOptions={createDepartmentOptions}
          onPromptChange={onPromptChange}
          onLevelChange={onLevelChange}
          onCollegeChange={handleCreateCollegeChange}
          onDepartmentChange={setCreateDepartment}
          onSourceLinkChange={handleSourceLinkChange}
          onAddSourceLink={() => setSourceLinks((currentLinks) => [...currentLinks, ""])}
          onSubmit={handleCreateSubmit}
          onOpenSettings={(event) => {
            onOpenSettings(event);
            setIsCreateModalOpen(false);
          }}
          onClose={() => setIsCreateModalOpen(false)}
        />
      )}

      {infoCourse && (
        <CourseInfoModal
          course={infoCourse}
          isPublishing={publishingCourseKey === infoCourse.key}
          onPublishCourse={(course) => {
            onPublishCourse(course);
            setInfoCourse(null);
          }}
          onClose={() => setInfoCourse(null)}
        />
      )}

      <CatalogFooter />
    </div>
  );
}

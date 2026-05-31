import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, MouseEvent } from "react";
import type { LyciumProgram, LyciumRequirementGroup } from "@lycium/contracts";
import CatalogFooter from "../CatalogFooter/CatalogFooter";
import type { CourseEntry } from "../../courseTypes";
import { courseCategories, getCourseCategoryDepartments, getCourseCategoryLabel } from "../../courseData/courseTaxonomy";
import CatalogCourseGrid from "./CatalogCourseGrid";
import CatalogPagination from "./CatalogPagination";
import CatalogProgramShowcase from "./CatalogProgramShowcase";
import CatalogToolbar from "./CatalogToolbar";
import CourseInfoModal from "./CourseInfoModal";
import CreateCourseModal from "./CreateCourseModal";
import { getVisibleCatalogCourses } from "./catalogCourseFiltering";
import { groupCourseIds } from "./catalogProgramProgress";
import {
  CATALOG_COURSE_CARD_MIN_WIDTH,
  CATALOG_DESKTOP_ROWS_PER_PAGE,
  CATALOG_LEVEL_OPTIONS,
  CATALOG_MOBILE_ROWS_PER_PAGE,
  type CatalogActivityFilter,
  type CatalogSortMode,
  type CatalogViewLevel,
  getCollegeFilterLabel,
  getGeneratingCourseTitle,
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
      showLockedCourses,
      sortMode,
    ],
  );

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
          <CatalogToolbar
            catalogViewLevel={catalogViewLevel}
            selectedProgram={selectedProgram}
            searchQuery={searchQuery}
            sortMode={sortMode}
            activeFilterCount={activeFilterCount}
            showLockedCourses={showLockedCourses}
            collegeFilter={collegeFilter}
            collegeFilterOptions={collegeFilterOptions}
            departmentFilter={departmentFilter}
            departmentFilterOptions={departmentFilterOptions}
            difficultyFilter={difficultyFilter}
            difficultyFilterOptions={difficultyFilterOptions}
            activityFilter={activityFilter}
            onCatalogViewLevelChange={handleCatalogViewLevelChange}
            onSearchQueryChange={handleSearchQueryChange}
            onSortModeChange={handleSortModeChange}
            onShowLockedCoursesChange={handleShowLockedCoursesChange}
            onCollegeFilterChange={handleCollegeFilterChange}
            onDepartmentFilterChange={handleDepartmentFilterChange}
            onDifficultyFilterChange={handleDifficultyFilterChange}
            onActivityFilterChange={handleActivityFilterChange}
            onResetCatalogFilters={handleResetCatalogFilters}
          />

          {(catalogViewLevel === "programs" || catalogViewLevel === "clusters") && (
            <CatalogProgramShowcase
              viewLevel={catalogViewLevel}
              programs={programs}
              selectedProgram={selectedProgram}
              courses={courses}
              courseMap={catalogCourseMap}
              onProgramSelect={handleProgramSelect}
              onClusterSelect={handleClusterSelect}
              onOpenProgram={onOpenProgram}
            />
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
              <CatalogCourseGrid
                courseGridRef={courseGridRef}
                isGeneratingCourse={isGeneratingCourse}
                generatingCourseTitle={generatingCourseTitle}
                generateMessage={generateMessage}
                visibleCourses={visibleCourses}
                catalogPageCourses={catalogPageCourses}
                publishingCourseKey={publishingCourseKey}
                onCreateCourse={() => setIsCreateModalOpen(true)}
                onOpenCourse={onOpenCourse}
                onOpenInfo={setInfoCourse}
              />
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

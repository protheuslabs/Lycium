import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, MouseEvent } from "react";
import type { LyciumProgram, LyciumRequirementGroup } from "@lycium/contracts";
import CatalogFooter from "../CatalogFooter/CatalogFooter";
import type { CourseEntry } from "../../courseTypes";
import { courseCategories, getCourseCategoryDepartments } from "../../courseData/courseTaxonomy";
import CatalogCourseGrid from "./CatalogCourseGrid";
import CatalogPagination from "./CatalogPagination";
import CatalogProgramShowcase from "./CatalogProgramShowcase";
import CatalogToolbar from "./CatalogToolbar";
import CourseInfoModal from "./CourseInfoModal";
import CreateCourseModal from "./CreateCourseModal";
import {
  CATALOG_COURSE_CARD_MIN_WIDTH,
  CATALOG_DESKTOP_ROWS_PER_PAGE,
  CATALOG_LEVEL_OPTIONS,
  CATALOG_MOBILE_ROWS_PER_PAGE,
  type CatalogViewLevel,
  getGeneratingCourseTitle,
} from "./catalogUtils";
import { useCatalogControls } from "./useCatalogControls";

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
  const [createCollege, setCreateCollege] = useState("");
  const [createDepartment, setCreateDepartment] = useState("");
  const [coursesPerPage, setCoursesPerPage] = useState(CATALOG_DESKTOP_ROWS_PER_PAGE - 1);
  const courseGridRef = useRef<HTMLDivElement | null>(null);
  const isGeneratingCourse = generateStatus === "loading";
  const generatingCourseTitle = getGeneratingCourseTitle(prompt);
  const catalogControls = useCatalogControls({
    courses,
    programs,
    catalogView,
    catalogProgramId,
    catalogClusterId,
    onCatalogDrilldown,
  });
  const createCollegeOptions = useMemo(
    () => courseCategories.map((category) => ({ value: category.id, label: category.label })),
    [],
  );
  const createDepartmentOptions = useMemo(
    () => getCourseCategoryDepartments(createCollege).map((department) => ({ value: department.id, label: department.label })),
    [createCollege],
  );

  const totalCatalogPages = Math.max(1, Math.ceil(catalogControls.visibleCourses.length / coursesPerPage));
  const activeCatalogPage = Math.min(catalogControls.catalogPage, totalCatalogPages);
  const catalogPageStartIndex = (activeCatalogPage - 1) * coursesPerPage;
  const catalogPageCourses = catalogControls.visibleCourses.slice(
    catalogPageStartIndex,
    catalogPageStartIndex + coursesPerPage,
  );
  const firstVisibleResult = catalogControls.visibleCourses.length === 0 ? 0 : catalogPageStartIndex + 1;
  const lastVisibleResult = Math.min(catalogPageStartIndex + coursesPerPage, catalogControls.visibleCourses.length);
  const shouldShowCatalogPagination = catalogControls.visibleCourses.length > coursesPerPage;

  useEffect(() => {
    if (catalogControls.catalogViewLevel !== "courses") {
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
  }, [catalogControls.catalogViewLevel, isGeneratingCourse]);

  const handleCreateCollegeChange = (value: string) => {
    setCreateCollege(value);
    setCreateDepartment("");
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
            catalogViewLevel={catalogControls.catalogViewLevel}
            selectedProgramId={catalogControls.selectedProgramId}
            programOptions={catalogControls.programOptions}
            searchQuery={catalogControls.searchQuery}
            sortMode={catalogControls.sortMode}
            pathSortMode={catalogControls.pathSortMode}
            activeFilterCount={catalogControls.activeFilterCount}
            showLockedCourses={catalogControls.showLockedCourses}
            collegeFilter={catalogControls.collegeFilter}
            collegeFilterOptions={catalogControls.collegeFilterOptions}
            departmentFilter={catalogControls.departmentFilter}
            departmentFilterOptions={catalogControls.departmentFilterOptions}
            difficultyFilter={catalogControls.difficultyFilter}
            difficultyFilterOptions={catalogControls.difficultyFilterOptions}
            activityFilter={catalogControls.activityFilter}
            onCatalogViewLevelChange={catalogControls.handleCatalogViewLevelChange}
            onSearchQueryChange={catalogControls.handleSearchQueryChange}
            onSortModeChange={catalogControls.handleSortModeChange}
            onPathSortModeChange={catalogControls.handlePathSortModeChange}
            onSelectedProgramChange={catalogControls.handleSelectedProgramChange}
            onShowLockedCoursesChange={catalogControls.handleShowLockedCoursesChange}
            onCollegeFilterChange={catalogControls.handleCollegeFilterChange}
            onDepartmentFilterChange={catalogControls.handleDepartmentFilterChange}
            onDifficultyFilterChange={catalogControls.handleDifficultyFilterChange}
            onActivityFilterChange={catalogControls.handleActivityFilterChange}
            onResetCatalogFilters={catalogControls.handleResetCatalogFilters}
          />

          {(catalogControls.catalogViewLevel === "programs" || catalogControls.catalogViewLevel === "clusters") && (
            <CatalogProgramShowcase
              viewLevel={catalogControls.catalogViewLevel}
              programs={catalogControls.visiblePrograms}
              clusters={catalogControls.visibleClusters}
              selectedProgram={catalogControls.selectedProgram}
              onProgramSelect={catalogControls.handleProgramSelect}
              onClusterSelect={catalogControls.handleClusterSelect}
              onOpenProgram={onOpenProgram}
            />
          )}

          {catalogControls.catalogViewLevel === "courses" && (
            <>
              {catalogControls.selectedCluster && catalogControls.selectedProgram && (
                <div className="catalog-course-scope" aria-live="polite">
                  <span>
                    Courses in {catalogControls.selectedProgram.title} / {catalogControls.selectedCluster.displayName}
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
                visibleCourses={catalogControls.visibleCourses}
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
                  totalResults={catalogControls.visibleCourses.length}
                  onPageChange={catalogControls.setCatalogPage}
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

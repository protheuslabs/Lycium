import { useEffect, useRef, useState } from "react";
import type { FormEvent, MouseEvent } from "react";
import type { LyciumProgram, LyciumRequirementGroup } from "@lycium/contracts";
import CatalogFooter from "../CatalogFooter/CatalogFooter";
import type { CourseEntry } from "../../courseTypes";
import CatalogCourseGrid from "./CatalogCourseGrid";
import CatalogPagination from "./CatalogPagination";
import CatalogPathRow from "./CatalogPathRow";
import CatalogProgramShowcase from "./CatalogProgramShowcase";
import CatalogRequirementRows from "./CatalogRequirementRows";
import CatalogToolbar from "./CatalogToolbar";
import CourseInfoModal from "./CourseInfoModal";
import CreateCourseModal from "./CreateCourseModal";
import CourseSourceGapModal from "./CourseSourceGapModal";
import {
  CATALOG_COURSE_CARD_MIN_WIDTH,
  CATALOG_DESKTOP_ROWS_PER_PAGE,
  CATALOG_LEVEL_OPTIONS,
  CATALOG_MOBILE_ROWS_PER_PAGE,
  type CatalogViewLevel,
  canCreateCourseInCatalogScope,
  getGeneratingCourseTitle,
} from "./catalogUtils";
import { useCatalogControls } from "./useCatalogControls";
import { useCreateCourseModal } from "./useCreateCourseModal";

type CourseCatalogProps = {
  courses: CourseEntry[];
  programs: LyciumProgram[];
  catalogView: "programs" | "courses" | null;
  catalogProgramId: string | null;
  catalogClusterId: string | null;
  prompt: string;
  level: string;
  canCreateCourse: boolean;
  aiLockedReason: string;
  generateStatus: "idle" | "loading" | "error" | "success";
  generateMessage: string;
  onPromptChange: (value: string) => void;
  onLevelChange: (value: string) => void;
  onGenerateCourse: (
    event: FormEvent<HTMLFormElement>,
    sourceLinks: string[],
    classification: { category: string; department: string },
    sourceFiles: File[],
  ) => void;
  onOpenCourse: (course: CourseEntry) => void;
  onQueueCourseSourceGap: (course: CourseEntry, gapId: string, url: string, description: string) => void;
  onResumeCourseSourceGap: (course: CourseEntry, gapId: string, url: string, description: string, files: File[]) => void;
  onCatalogDrilldown: (
    viewLevel: CatalogViewLevel,
    program?: LyciumProgram | null,
    cluster?: LyciumRequirementGroup | null,
  ) => void;
  onPublishCourse: (course: CourseEntry) => void;
  onForkCourse: (course: CourseEntry) => void;
  onCreateManualCourse: () => void;
  onDeleteCourseDraft: (course: CourseEntry) => void;
  onExportCourseDraft: (course: CourseEntry) => void;
  onImportCourseDraft: (file: File) => Promise<void>;
  onResetCourseDraft: (course: CourseEntry) => void;
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
  aiLockedReason,
  generateStatus,
  generateMessage,
  onPromptChange,
  onLevelChange,
  onGenerateCourse,
  onOpenCourse,
  onQueueCourseSourceGap,
  onResumeCourseSourceGap,
  onCatalogDrilldown,
  onPublishCourse,
  onForkCourse,
  onCreateManualCourse,
  onDeleteCourseDraft,
  onExportCourseDraft,
  onImportCourseDraft,
  onResetCourseDraft,
  publishingCourseKey,
  onOpenSettings,
}: CourseCatalogProps) {
  const [infoCourse, setInfoCourse] = useState<CourseEntry | null>(null);
  const [sourceGapCourse, setSourceGapCourse] = useState<CourseEntry | null>(null);
  const [coursesPerPage, setCoursesPerPage] = useState(CATALOG_DESKTOP_ROWS_PER_PAGE * 4);
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
  const createCourseModal = useCreateCourseModal({ canCreateCourse, onGenerateCourse, onCreateManualCourse });
  const canCreateCourseInScope = canCreateCourseInCatalogScope(
    catalogControls.selectedProgram,
    catalogControls.selectedCluster,
  );
  const shouldShowCatalogPath =
    Boolean(catalogControls.selectedProgram) &&
    (catalogControls.catalogViewLevel === "clusters" || Boolean(catalogControls.selectedCluster));

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
      const gridStyle = getComputedStyle(grid);
      const gridWidth = grid.clientWidth;
      const gap = Number.parseFloat(gridStyle.columnGap || "0") || 0;
      const measuredColumns = gridStyle.gridTemplateColumns
        .split(" ")
        .filter((column) => column.trim() && column !== "none").length;
      const estimatedColumns = Math.floor((gridWidth + gap) / (CATALOG_COURSE_CARD_MIN_WIDTH + gap));
      const columns = Math.max(1, measuredColumns || estimatedColumns);
      const rowsPerPage = window.matchMedia("(max-width: 860px)").matches
        ? CATALOG_MOBILE_ROWS_PER_PAGE
        : CATALOG_DESKTOP_ROWS_PER_PAGE;
      const leadingCatalogCards = isGeneratingCourse ? 1 : 0;
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

  return (
    <div className="catalog-shell">
      <main className="home-page">
        <section className="catalog-page">
          <CatalogToolbar
            catalogViewLevel={catalogControls.catalogViewLevel}
            searchQuery={catalogControls.searchQuery}
            sortMode={catalogControls.sortMode}
            pathSortMode={catalogControls.pathSortMode}
            canCreateCourseInScope={canCreateCourseInScope}
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
            onCreateCourse={() => createCourseModal.setIsOpen(true)}
            onShowLockedCoursesChange={catalogControls.handleShowLockedCoursesChange}
            onCollegeFilterChange={catalogControls.handleCollegeFilterChange}
            onDepartmentFilterChange={catalogControls.handleDepartmentFilterChange}
            onDifficultyFilterChange={catalogControls.handleDifficultyFilterChange}
            onActivityFilterChange={catalogControls.handleActivityFilterChange}
            onResetCatalogFilters={catalogControls.handleResetCatalogFilters}
          />
          <CatalogPathRow
            show={shouldShowCatalogPath}
            program={catalogControls.selectedProgram}
            cluster={catalogControls.selectedCluster}
            onNavigatePrograms={() => onCatalogDrilldown("programs")}
            onNavigateProgram={() => onCatalogDrilldown("clusters", catalogControls.selectedProgram)}
            onNavigateCluster={() =>
              onCatalogDrilldown("courses", catalogControls.selectedProgram, catalogControls.selectedCluster)
            }
          />

          {(catalogControls.catalogViewLevel === "programs" || catalogControls.catalogViewLevel === "clusters") && (
            <CatalogProgramShowcase
              viewLevel={catalogControls.catalogViewLevel}
              programs={catalogControls.visiblePrograms}
              clusters={catalogControls.visibleClusters}
              selectedProgram={catalogControls.selectedProgram}
              onProgramSelect={catalogControls.handleProgramSelect}
              onClusterSelect={catalogControls.handleClusterSelect}
            />
          )}

          {catalogControls.catalogViewLevel === "courses" && (
            <>
              {catalogControls.selectedCluster && (
                <CatalogRequirementRows
                  group={catalogControls.selectedCluster}
                  courseMap={catalogControls.catalogCourseMap}
                  progressCache={catalogControls.catalogProgressCache}
                  onOpenCourse={onOpenCourse}
                  onOpenSourceGaps={setSourceGapCourse}
                />
              )}
              <CatalogCourseGrid
                courseGridRef={courseGridRef}
                isGeneratingCourse={isGeneratingCourse}
                generatingCourseTitle={generatingCourseTitle}
                generateMessage={generateMessage}
                visibleCourses={catalogControls.visibleCourses}
                catalogPageCourses={catalogPageCourses}
                publishingCourseKey={publishingCourseKey}
                onOpenCourse={onOpenCourse}
                onOpenInfo={setInfoCourse}
                onOpenSourceGaps={setSourceGapCourse}
                onSearchPrerequisite={catalogControls.handlePrerequisiteSearch}
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

      {createCourseModal.isOpen && (
        <CreateCourseModal
          prompt={prompt}
          level={level}
          sourceLinks={createCourseModal.sourceLinks}
          sourceFiles={createCourseModal.sourceFiles}
          canCreateCourse={canCreateCourse}
          aiLockedReason={aiLockedReason}
          generateStatus={generateStatus}
          generateMessage={generateMessage}
          levelOptions={CATALOG_LEVEL_OPTIONS}
          college={createCourseModal.college}
          department={createCourseModal.department}
          mode={createCourseModal.mode}
          collegeOptions={createCourseModal.collegeOptions}
          departmentOptions={createCourseModal.departmentOptions}
          onPromptChange={onPromptChange}
          onLevelChange={onLevelChange}
          onCollegeChange={createCourseModal.handleCollegeChange}
          onDepartmentChange={createCourseModal.setDepartment}
          onSourceLinkChange={createCourseModal.handleSourceLinkChange}
          onSourceFilesChange={createCourseModal.handleSourceFilesChange}
          onRemoveSourceFile={createCourseModal.handleRemoveSourceFile}
          onAddSourceLink={createCourseModal.addSourceLink}
          onModeChange={createCourseModal.setMode}
          onSubmit={createCourseModal.handleSubmit}
          onOpenSettings={(event) => {
            onOpenSettings(event);
            createCourseModal.setIsOpen(false);
          }}
          onClose={() => createCourseModal.setIsOpen(false)}
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
          onForkCourse={(course) => {
            onForkCourse(course);
            setInfoCourse(null);
          }}
          onDeleteCourseDraft={(course) => {
            onDeleteCourseDraft(course);
            setInfoCourse(null);
          }}
          onExportCourseDraft={onExportCourseDraft}
          onImportCourseDraft={async (file) => {
            await onImportCourseDraft(file);
            setInfoCourse(null);
          }}
          onResetCourseDraft={(course) => {
            onResetCourseDraft(course);
            setInfoCourse(null);
          }}
          onClose={() => setInfoCourse(null)}
        />
      )}

      {sourceGapCourse && (
        <CourseSourceGapModal
          course={sourceGapCourse}
          onQueueSource={async (course, gapId, url, description, files) => {
            if (course.snapshotId) {
              await onResumeCourseSourceGap(course, gapId, url, description, files);
              return;
            }
            onQueueCourseSourceGap(course, gapId, url, description);
          }}
          onClose={() => setSourceGapCourse(null)}
        />
      )}

      <CatalogFooter />
    </div>
  );
}

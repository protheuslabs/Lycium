import { useEffect, useRef, useState } from "react";
import type { FormEvent, MouseEvent } from "react";
import { createPortal } from "react-dom";
import type { LyciumProgram, LyciumRequirementGroup } from "@lycium/contracts";
import CatalogFooter from "../CatalogFooter/CatalogFooter";
import Dropdown from "../Dropdown/Dropdown";
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
import ProgramStructureEditorModal from "./ProgramStructureEditorModal";
import {
  CATALOG_COURSE_CARD_MIN_WIDTH,
  CATALOG_DESKTOP_ROWS_PER_PAGE,
  CATALOG_LEVEL_OPTIONS,
  CATALOG_MOBILE_ROWS_PER_PAGE,
  CATALOG_VIEW_LEVEL_OPTIONS,
  type CatalogViewLevel,
  canCreateEntityInCatalogScope,
  getGeneratingCourseTitle,
} from "./catalogUtils";
import { useCatalogControls } from "./useCatalogControls";
import { useCreateCourseModal } from "./useCreateCourseModal";
import type { CatalogSelectionMode } from "../../utils/catalogSelection";
import { useClientMounted } from "../../hooks/useClientMounted";

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
  catalogSelectionMode: CatalogSelectionMode;
  programEditor: {
    editor: {
      isOpen: boolean;
      kind: "program" | "cluster";
      mode: "create" | "edit";
      title: string;
      description: string;
      programId: string | null;
      clusterId: string | null;
    };
    selectedProgram: LyciumProgram | null;
    selectedCluster: LyciumRequirementGroup | null;
    confirmDeleteOpen: boolean;
    openCreateProgramEditor: () => void;
    openEditProgramEditor: (program: LyciumProgram) => void;
    openCreateClusterEditor: (program: LyciumProgram | null) => void;
    openEditClusterEditor: (program: LyciumProgram, cluster: LyciumRequirementGroup) => void;
    setTitle: (value: string) => void;
    setDescription: (value: string) => void;
    saveEditor: () => { program: LyciumProgram; cluster: LyciumRequirementGroup | null } | null;
    closeEditor: () => void;
    setConfirmDeleteOpen: (open: boolean) => void;
    deleteEditorTarget: () => void;
  };
  onStartProgramSelection: (programId: string) => void;
  onStartClusterSelection: (programId: string, clusterId: string) => void;
  onToggleProgramClusterSelection: (programId: string, clusterId: string) => void;
  onToggleClusterCourseSelection: (courseKey: string) => void;
  onCommitCatalogSelection: () => void;
  onCancelCatalogSelection: () => void;
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
  catalogSelectionMode,
  programEditor,
  onStartProgramSelection,
  onStartClusterSelection,
  onToggleProgramClusterSelection,
  onToggleClusterCourseSelection,
  onCommitCatalogSelection,
  onCancelCatalogSelection,
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
  const isClientMounted = useClientMounted();
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
    selectionMode: catalogSelectionMode,
  });
  const createCourseModal = useCreateCourseModal({ canCreateCourse, onGenerateCourse, onCreateManualCourse });
  const isProgramSelectionMode = catalogSelectionMode?.kind === "program";
  const isClusterSelectionMode = catalogSelectionMode?.kind === "cluster";
  const isSelectionMode = Boolean(catalogSelectionMode);
  const canCreateInScope = canCreateEntityInCatalogScope(
    catalogControls.catalogViewLevel,
    catalogControls.selectedProgram,
    catalogControls.selectedCluster,
  );
  const primaryActionLabel = isProgramSelectionMode
    ? "Add clusters"
    : isClusterSelectionMode
      ? "Add courses"
      : catalogControls.catalogViewLevel === "programs"
        ? "Create program"
        : catalogControls.catalogViewLevel === "clusters"
          ? "Create cluster"
          : "Create course";
  const primaryActionDisabled =
    isProgramSelectionMode
      ? catalogSelectionMode.selectedClusterKeys.length === 0
      : isClusterSelectionMode
        ? catalogSelectionMode.selectedCourseKeys.length === 0
        : !canCreateInScope;
  const showContextAction =
    !isSelectionMode &&
    (
      (catalogControls.catalogViewLevel === "clusters" && catalogControls.selectedProgram?.reviewStatus === "draft") ||
      (
        catalogControls.catalogViewLevel === "courses" &&
        catalogControls.selectedProgram?.reviewStatus === "draft" &&
        Boolean(catalogControls.selectedCluster)
      )
    );
  const contextActionLabel =
    catalogControls.catalogViewLevel === "courses" && catalogControls.selectedCluster
      ? "Edit cluster"
      : "Edit program";
  const shouldShowCatalogPath =
    Boolean(catalogControls.selectedProgram) &&
    !isProgramSelectionMode &&
    (
      catalogControls.catalogViewLevel === "clusters" ||
      Boolean(catalogControls.selectedCluster) ||
      isClusterSelectionMode
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

  const topbarControlsHost = isClientMounted ? document.getElementById("top-bar-catalog-controls") : null;

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
      {topbarControlsHost &&
        createPortal(
          <div className="catalog-topbar-search" role="search">
            <Dropdown
              className="catalog-topbar-level-dropdown"
              value={catalogControls.catalogViewLevel}
              options={CATALOG_VIEW_LEVEL_OPTIONS}
              onChange={catalogControls.handleCatalogViewLevelChange}
              ariaLabel="Select catalog view level"
              disabled={isSelectionMode}
            />
            <label className="catalog-topbar-search-field">
              <input
                type="search"
                aria-label={`Search ${catalogControls.catalogViewLevel}`}
                placeholder={`Search ${catalogControls.catalogViewLevel}`}
                value={catalogControls.searchQuery}
                onChange={(event) => catalogControls.handleSearchQueryChange(event.target.value)}
              />
            </label>
          </div>,
          topbarControlsHost,
        )}
      <main className="home-page">
        <section className="catalog-page">
          <CatalogToolbar
            catalogViewLevel={catalogControls.catalogViewLevel}
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
            onSortModeChange={catalogControls.handleSortModeChange}
            onPathSortModeChange={catalogControls.handlePathSortModeChange}
            showPrimaryAction
            primaryActionLabel={primaryActionLabel}
            primaryActionDisabled={primaryActionDisabled}
            onPrimaryAction={() => {
              if (isSelectionMode) {
                onCommitCatalogSelection();
                return;
              }
              if (catalogControls.catalogViewLevel === "courses") {
                createCourseModal.setIsOpen(true);
                return;
              }
              if (catalogControls.catalogViewLevel === "programs") {
                programEditor.openCreateProgramEditor();
                return;
              }
              programEditor.openCreateClusterEditor(catalogControls.selectedProgram);
            }}
            showContextAction={showContextAction}
            contextActionLabel={contextActionLabel}
            onContextAction={() => {
              if (catalogControls.catalogViewLevel === "courses" && catalogControls.selectedProgram && catalogControls.selectedCluster) {
                programEditor.openEditClusterEditor(catalogControls.selectedProgram, catalogControls.selectedCluster);
                return;
              }
              if (catalogControls.selectedProgram) {
                programEditor.openEditProgramEditor(catalogControls.selectedProgram);
              }
            }}
            showCancelSelection={isSelectionMode}
            onCancelSelection={onCancelCatalogSelection}
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
              onToggleClusterSelection={onToggleProgramClusterSelection}
              selectionMode={catalogSelectionMode}
            />
          )}

          {catalogControls.catalogViewLevel === "courses" && (
            <>
              {catalogControls.selectedCluster && !isSelectionMode && (
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
                selectionMode={catalogSelectionMode}
                onToggleCourseSelection={onToggleClusterCourseSelection}
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

      <ProgramStructureEditorModal
        isOpen={programEditor.editor.isOpen}
        kind={programEditor.editor.kind}
        mode={programEditor.editor.mode}
        title={programEditor.editor.title}
        description={programEditor.editor.description}
        canDelete={programEditor.editor.mode === "edit"}
        confirmDeleteOpen={programEditor.confirmDeleteOpen}
        onTitleChange={programEditor.setTitle}
        onDescriptionChange={programEditor.setDescription}
        onSave={programEditor.saveEditor}
        onOpenSelector={() => {
          const saved = programEditor.saveEditor();
          if (!saved?.program) {
            return;
          }
          programEditor.closeEditor();
          if (programEditor.editor.kind === "program") {
            onStartProgramSelection(saved.program.id);
            return;
          }
          if (saved.cluster) {
            onStartClusterSelection(saved.program.id, saved.cluster.id);
          }
        }}
        onOpenDeleteConfirm={() => programEditor.setConfirmDeleteOpen(true)}
        onCloseDeleteConfirm={() => programEditor.setConfirmDeleteOpen(false)}
        onConfirmDelete={programEditor.deleteEditorTarget}
        onClose={programEditor.closeEditor}
      />

      <CatalogFooter />
    </div>
  );
}

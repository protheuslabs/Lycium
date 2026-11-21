import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import type { SectionStatus } from "../../courseTypes";
import {
  SidebarAddRow,
  SidebarEditControls,
  SidebarFinishButton,
  SidebarModuleHeader,
  SidebarSourceTab,
  type DisplayStatus,
} from "./SidebarPrimitives";
import SidebarSectionItem, { type SidebarSection } from "./SidebarSectionItem";
import { containDialogFocus } from "../../utils/dialogFocus";
import ProgressMeter from "../ProgressMeter/ProgressMeter";
import { PanelLeft, X } from "lucide-react";
import { useMediaQuery } from "../../hooks/useMediaQuery";

let persistedSidebarCollapsed = false;

type SidebarProps = {
  sections: SidebarSection[];
  currentSectionIndex: number;
  onSectionSelect: (index: number) => void;
  courseTitle: string;
  progressPercentage: number;
  viewedPercentage: number;
  sectionStatuses: Record<string, SectionStatus>;
  isSourcesActive?: boolean;
  sourceCount?: number;
  canEditCourse?: boolean;
  isEditMode?: boolean;
  onStartEdit?: () => void;
  onCancelEdit?: () => void;
  onSaveEdit?: () => void;
  onOpenCourseSettings?: () => void;
  onSourcesSelect?: () => void;
  onAddSection?: (moduleIndex: number) => void;
  onDeleteSection?: (sectionId: string) => void;
  onMoveSection?: (
    sectionId: string,
    targetModuleIndex: number,
    targetSectionIndex: number,
  ) => void;
  onAddModule?: () => void;
};
export default function Sidebar({
  sections,
  currentSectionIndex,
  onSectionSelect,
  courseTitle,
  progressPercentage,
  viewedPercentage,
  sectionStatuses,
  isSourcesActive = false,
  sourceCount = 0,
  canEditCourse = false,
  isEditMode = false,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onOpenCourseSettings,
  onSourcesSelect,
  onAddSection,
  onDeleteSection,
  onMoveSection,
  onAddModule,
}: SidebarProps) {
  const activeModuleIndex = isSourcesActive
    ? -1
    : (sections[currentSectionIndex]?.moduleIndex ?? 0);
  const [moduleExpansion, setModuleExpansion] = useState<Record<number, boolean>>({});
  const [isCollapsed, setIsCollapsed] = useState(() => persistedSidebarCollapsed);
  const isMobile = useMediaQuery("(max-width: 860px)");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [draggingSectionId, setDraggingSectionId] = useState<string | null>(null);

  useEffect(() => {
    if (!isMobile || !isDrawerOpen) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, [isMobile, isDrawerOpen]);

  const moduleGroups = useMemo(() => {
    const groups: Array<{
      moduleIndex: number;
      moduleTitle: string;
      sections: Array<{ section: SidebarSection; index: number }>;
    }> = [];

    sections.forEach((section, index) => {
      const existingGroup = groups.find((group) => group.moduleIndex === section.moduleIndex);

      if (existingGroup) {
        existingGroup.sections.push({ section, index });
        return;
      }

      groups.push({
        moduleIndex: section.moduleIndex,
        moduleTitle: section.moduleTitle,
        sections: [{ section, index }],
      });
    });

    return groups;
  }, [sections]);

  const getSectionStatus = useCallback(
    (sectionId: string): DisplayStatus => sectionStatuses[sectionId] ?? "available",
    [sectionStatuses],
  );

  const toggleModule = useCallback(
    (moduleIndex: number) => {
      setModuleExpansion((current) => ({
        ...current,
        [moduleIndex]: !(current[moduleIndex] ?? moduleIndex === activeModuleIndex),
      }));
    },
    [activeModuleIndex],
  );

  const toggleCollapsed = () => {
    if (isMobile) {
      setIsDrawerOpen((open) => !open);
    } else {
      persistedSidebarCollapsed = !isCollapsed;
      setIsCollapsed(!isCollapsed);
    }
  };

  const closeOutline = () => {
    if (isMobile) setIsDrawerOpen(false);
    else {
      persistedSidebarCollapsed = true;
      setIsCollapsed(true);
    }
  };

  const selectSection = (index: number) => {
    onSectionSelect(index);
    if (isMobile) setIsDrawerOpen(false);
  };

  const handleSectionListDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>, moduleIndex: number, targetSectionIndex: number) => {
      if (!isEditMode || !onMoveSection) {
        return;
      }

      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      if (event.target !== event.currentTarget) {
        return;
      }

      const sectionId = event.dataTransfer.getData("text/plain") || draggingSectionId;
      if (sectionId) {
        onMoveSection(sectionId, moduleIndex, targetSectionIndex);
      }
    },
    [draggingSectionId, isEditMode, onMoveSection],
  );

  const handleSectionListDrop = useCallback(
    (event: DragEvent<HTMLDivElement>, moduleIndex: number, targetSectionIndex: number) => {
      if (!isEditMode || !onMoveSection) {
        return;
      }

      event.preventDefault();
      const sectionId = event.dataTransfer.getData("text/plain") || draggingSectionId;
      if (sectionId) {
        onMoveSection(sectionId, moduleIndex, targetSectionIndex);
      }
      setDraggingSectionId(null);
    },
    [draggingSectionId, isEditMode, onMoveSection],
  );

  const outline = (
    <>
      <div className="sidebar-heading">
        <h2>Course outline</h2>
        <button
          type="button"
          className="sidebar-close"
          aria-label="Close course outline"
          title="Close course outline"
          onClick={closeOutline}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <div className="progress-wrapper">
        <p className="sidebar-title">{courseTitle}</p>
        <ProgressMeter
          cacheKey={`sidebar:${courseTitle}`}
          progressPercentage={progressPercentage}
          viewedPercentage={viewedPercentage}
        />
      </div>

      <nav className="sidebar-section-list" aria-label="Course sections">
        {moduleGroups.map((moduleGroup) => {
          const isActiveModule = moduleGroup.moduleIndex === activeModuleIndex;
          const isExpanded = moduleExpansion[moduleGroup.moduleIndex] ?? isActiveModule;

          return (
            <section className="sidebar-module" key={moduleGroup.moduleIndex}>
              <SidebarModuleHeader
                moduleIndex={moduleGroup.moduleIndex}
                moduleTitle={moduleGroup.moduleTitle}
                isExpanded={isExpanded}
                isActiveModule={isActiveModule}
                completedCount={moduleGroup.sections.filter(({ section }) => getSectionStatus(section.id) === "completed").length}
                totalCount={moduleGroup.sections.length}
                isCollapsed={false}
                onToggleModule={toggleModule}
              />

              {isExpanded && (
                <div
                  className="sidebar-module-sections"
                  onDragOver={(event) =>
                    handleSectionListDragOver(
                      event,
                      moduleGroup.moduleIndex,
                      moduleGroup.sections.length,
                    )
                  }
                  onDrop={(event) =>
                    handleSectionListDrop(
                      event,
                      moduleGroup.moduleIndex,
                      moduleGroup.sections.length,
                    )
                  }
                >
                  {moduleGroup.sections.map(({ section, index: idx }) => {
                    const sectionStatus = getSectionStatus(section.id);

                    return (
                      <SidebarSectionItem
                        key={section.id}
                        section={section}
                        index={idx}
                        status={sectionStatus}
                        isActive={idx === currentSectionIndex}
                        isCollapsed={false}
                        isEditMode={isEditMode}
                        isDragging={draggingSectionId === section.id}
                        draggingSectionId={draggingSectionId}
                        onSectionSelect={selectSection}
                        onDeleteSection={onDeleteSection}
                        onDragStartSection={setDraggingSectionId}
                        onDragEndSection={() => setDraggingSectionId(null)}
                        onMoveSection={onMoveSection}
                      />
                    );
                  })}
                  {isEditMode && (
                    <SidebarAddRow
                      label="Add section"
                      isCollapsed={false}
                      onClick={() => onAddSection?.(moduleGroup.moduleIndex)}
                    />
                  )}
                </div>
              )}
            </section>
          );
        })}
        <SidebarSourceTab
          isActive={isSourcesActive}
          isCollapsed={false}
          sourceCount={sourceCount}
          onSelect={() => {
            onSourcesSelect?.();
            if (isMobile) setIsDrawerOpen(false);
          }}
        />
        {isEditMode && (
          <SidebarAddRow label="Add module" isCollapsed={false} onClick={onAddModule} />
        )}
      </nav>

      {isEditMode && <SidebarFinishButton isCollapsed={false} onFinish={onSaveEdit} />}
    </>
  );

  return (
    <>
      <div className="course-outline-toolbar">
        <button
          type="button"
          className="course-outline-trigger"
          aria-expanded={isMobile ? isDrawerOpen : !isCollapsed}
          aria-controls="course-outline-panel"
          onClick={toggleCollapsed}
        >
          <PanelLeft size={18} aria-hidden="true" />
          <span>Course outline</span>
        </button>
        <span className="course-position">
          {isSourcesActive ? "Sources" : `Section ${currentSectionIndex + 1} of ${sections.length}`}
        </span>
        {canEditCourse && (
          <SidebarEditControls
            isEditMode={isEditMode}
            onStartEdit={onStartEdit}
            onCancelEdit={onCancelEdit}
            onSaveEdit={onSaveEdit}
            onOpenCourseSettings={onOpenCourseSettings}
          />
        )}
      </div>
      {isMobile ? (
        <dialog
          ref={dialogRef}
          onKeyDown={containDialogFocus}
          id="course-outline-panel"
          className="sidebar-drawer"
          aria-label="Course outline"
          onCancel={(event) => {
            event.preventDefault();
            setIsDrawerOpen(false);
          }}
          onClose={() => setIsDrawerOpen(false)}
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            if (
              event.target === event.currentTarget &&
              (event.clientX < rect.left ||
                event.clientX > rect.right ||
                event.clientY < rect.top ||
                event.clientY > rect.bottom)
            )
              setIsDrawerOpen(false);
          }}
        >
          {outline}
        </dialog>
      ) : (
        <aside
          id="course-outline-panel"
          className={`sidebar ${isCollapsed ? "sidebar--collapsed" : ""}`}
          aria-label="Course outline"
        >
          {outline}
        </aside>
      )}
    </>
  );
}

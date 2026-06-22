import { memo, useCallback, useMemo, useRef, useState, type DragEvent } from "react";
import type { SectionStatus } from "../../courseTypes";
import { SidebarAddRow, SidebarEditControls, SidebarFinishButton, SidebarModuleHeader, SidebarSourceTab, SidebarStatusBadge, type DisplayStatus } from "./SidebarPrimitives";
import { DeleteBlockButton, promptForDeleteConfirmation } from "../ContentView/CourseEditControls";
import ProgressMeter from "../ProgressMeter/ProgressMeter";

type SidebarSection = {
  id: string;
  title: string;
  moduleIndex: number;
  moduleTitle: string;
  displayNumber: string;
};

let persistedSidebarCollapsed = true;

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
  onMoveSection?: (sectionId: string, targetModuleIndex: number, targetSectionIndex: number) => void;
  onAddModule?: () => void;
};
const SidebarSectionItem = memo(function SidebarSectionItem({
  section,
  index,
  status,
  isActive,
  isCollapsed,
  isEditMode,
  isDragging,
  draggingSectionId,
  onSectionSelect,
  onDeleteSection,
  onDragStartSection,
  onDragEndSection,
  onMoveSection,
}: {
  section: SidebarSection;
  index: number;
  status: DisplayStatus;
  isActive: boolean;
  isCollapsed: boolean;
  isEditMode: boolean;
  isDragging: boolean;
  draggingSectionId: string | null;
  onSectionSelect: (index: number) => void;
  onDeleteSection?: (sectionId: string) => void;
  onDragStartSection?: (sectionId: string) => void;
  onDragEndSection?: () => void;
  onMoveSection?: (sectionId: string, targetModuleIndex: number, targetSectionIndex: number) => void;
}) {
  const isLocked = status === "locked";
  const targetSectionIndex = Number(section.displayNumber.split(".")[1] ?? 1) - 1;
  const handleClick = useCallback(() => {
    if (!isLocked) {
      onSectionSelect(index);
    }
  }, [index, isLocked, onSectionSelect]);

  const handleDragStart = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!isEditMode || !onMoveSection) {
        return;
      }

      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", section.id);
      onDragStartSection?.(section.id);
    },
    [isEditMode, onDragStartSection, onMoveSection, section.id],
  );

  const handleDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!isEditMode || !onMoveSection) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = "move";
      const draggedId = event.dataTransfer.getData("text/plain") || draggingSectionId;
      if (draggedId && draggedId !== section.id) {
        const bounds = event.currentTarget.getBoundingClientRect();
        const targetIndex = targetSectionIndex + (event.clientY > bounds.top + bounds.height / 2 ? 1 : 0);
        onMoveSection(draggedId, section.moduleIndex, targetIndex);
      }
    },
    [draggingSectionId, isEditMode, onMoveSection, section.id, section.moduleIndex, targetSectionIndex],
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!isEditMode || !onMoveSection) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      const sectionId = event.dataTransfer.getData("text/plain");
      if (sectionId) {
        onMoveSection(sectionId, section.moduleIndex, targetSectionIndex);
      }
      onDragEndSection?.();
    },
    [isEditMode, onDragEndSection, onMoveSection, section.moduleIndex, targetSectionIndex],
  );

  return (
    <div
      className={`sidebar-item ${isActive ? "active" : ""} ${isLocked ? "locked" : ""} ${
        isDragging ? "sidebar-item--dragging" : ""
      } ${isEditMode ? "sidebar-item--editable" : ""}`}
      onClick={handleClick}
      aria-disabled={isLocked}
      draggable={isEditMode}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragEnd={() => onDragEndSection?.()}
    >
      <span className="sidebar-item-label">
        {isCollapsed ? section.displayNumber : `${section.displayNumber} ${section.title}`}
      </span>
      {isEditMode ? (
        <DeleteBlockButton
          label={`Delete ${section.displayNumber} ${section.title}`}
          onClick={() => promptForDeleteConfirmation(() => onDeleteSection?.(section.id), "Delete section", "Are you sure you want to delete this section?")}
        />
      ) : (
        <SidebarStatusBadge status={status} />
      )}
    </div>
  );
});

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
  const activeModuleIndex = isSourcesActive ? -1 : sections[currentSectionIndex]?.moduleIndex ?? 0;
  const activeModuleIndexRef = useRef(activeModuleIndex);
  activeModuleIndexRef.current = activeModuleIndex;
  const [expandedModules, setExpandedModules] = useState<Set<number>>(() => new Set());
  const [isCollapsed, setIsCollapsed] = useState(() => persistedSidebarCollapsed);
  const [isContentFading, setIsContentFading] = useState(false);
  const [draggingSectionId, setDraggingSectionId] = useState<string | null>(null);
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

  const toggleModule = useCallback((moduleIndex: number) => {
    if (moduleIndex === activeModuleIndexRef.current) {
      return;
    }

    setExpandedModules((current) => {
      const next = new Set(current);

      if (next.has(moduleIndex)) {
        next.delete(moduleIndex);
      } else {
        next.add(moduleIndex);
      }

      return next;
    });
  }, []);

  const toggleCollapsed = () => {
    setIsContentFading(true);
    window.setTimeout(() => {
      setIsCollapsed((collapsed) => {
        const nextCollapsed = !collapsed;
        persistedSidebarCollapsed = nextCollapsed;
        return nextCollapsed;
      });
      window.setTimeout(() => setIsContentFading(false), 220);
    }, 120);
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
  
  return (
    <aside className={`sidebar ${isCollapsed ? "sidebar--collapsed" : ""} ${isContentFading ? "sidebar--content-fading" : ""}`}>
      <button
        className="sidebar-pulltab"
        type="button"
        aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-expanded={!isCollapsed}
        onClick={toggleCollapsed}
      >
        <span aria-hidden="true">{isCollapsed ? "›" : "‹"}</span>
      </button>

      {canEditCourse && (
        <SidebarEditControls
          isEditMode={isEditMode}
          onStartEdit={onStartEdit}
          onCancelEdit={onCancelEdit}
          onSaveEdit={onSaveEdit}
          onOpenCourseSettings={onOpenCourseSettings}
        />
      )}

      {!isEditMode && (
        <div className="progress-wrapper" aria-hidden={isCollapsed}>
          <h3 className="sidebar-title">{courseTitle}</h3>
          <ProgressMeter
            cacheKey={`sidebar:${courseTitle}`}
            progressPercentage={progressPercentage}
            viewedPercentage={viewedPercentage}
          />
        </div>
      )}
      
      <div className="sidebar-section-list">
        {moduleGroups.map((moduleGroup) => {
          const isActiveModule = moduleGroup.moduleIndex === activeModuleIndex;
          const isExpanded = isActiveModule || expandedModules.has(moduleGroup.moduleIndex);
          
          return (
            <section className="sidebar-module" key={moduleGroup.moduleIndex}>
              <SidebarModuleHeader
                moduleIndex={moduleGroup.moduleIndex}
                moduleTitle={moduleGroup.moduleTitle}
                isExpanded={isExpanded}
                isActiveModule={isActiveModule}
                isCollapsed={isCollapsed}
                onToggleModule={toggleModule}
              />

              {isExpanded && (
                <div
                  className="sidebar-module-sections"
                  onDragOver={(event) => handleSectionListDragOver(event, moduleGroup.moduleIndex, moduleGroup.sections.length)}
                  onDrop={(event) => handleSectionListDrop(event, moduleGroup.moduleIndex, moduleGroup.sections.length)}
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
                        isCollapsed={isCollapsed}
                        isEditMode={isEditMode}
                        isDragging={draggingSectionId === section.id}
                        draggingSectionId={draggingSectionId}
                        onSectionSelect={onSectionSelect}
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
                        isCollapsed={isCollapsed}
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
            isCollapsed={isCollapsed}
            sourceCount={sourceCount}
            onSelect={onSourcesSelect}
          />
          {isEditMode && <SidebarAddRow label="Add module" isCollapsed={isCollapsed} onClick={onAddModule} />}
	      </div>

      {isEditMode && <SidebarFinishButton isCollapsed={isCollapsed} onFinish={onSaveEdit} />}
    </aside>
  )
}

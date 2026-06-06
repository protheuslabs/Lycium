import { memo, useCallback, useMemo, useRef, useState, type DragEvent } from "react";
import type { SectionStatus } from "../../courseTypes";
import { DeleteBlockButton, promptForDeleteBlock } from "../ContentView/CourseEditControls";
import ProgressMeter from "../ProgressMeter/ProgressMeter";

type SidebarSection = {
  id: string;
  title: string;
  moduleIndex: number;
  moduleTitle: string;
  displayNumber: string;
};

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

let persistedSidebarCollapsed = true;

type DisplayStatus = SectionStatus | "available";

function getStatusLabel(status: DisplayStatus): string {
  if (status === "completed") return "Completed";
  if (status === "locked") return "Locked";
  if (status === "seen") return "Seen";
  if (status === "timed") return "Quiz in progress";
  return "Available";
}

function getStatusClassName(status: DisplayStatus): string {
  if (status === "available") return "sidebar-status";
  if (status === "completed") return "sidebar-status sidebar-status--complete";
  return `sidebar-status sidebar-status--${status}`;
}

function SidebarStatusGlyph({ status }: { status: DisplayStatus }) {
  if (status === "completed") {
    return <span className="sidebar-status-check">✓</span>;
  }
  if (status === "locked") {
    return <span className="sidebar-lock-icon" aria-hidden="true" />;
  }
  if (status === "seen") {
    return (
      <svg className="sidebar-status-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 5C7 5 2.73 8.11 1 12c1.73 3.89 6 7 11 7s9.27-3.11 11-7c-1.73-3.89-6-7-11-7Zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8Z" />
        <circle cx="12" cy="12" r="2.2" />
      </svg>
    );
  }
  if (status === "timed") {
    return (
      <svg className="sidebar-status-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M7 2h10v2.5L14 8v1l3 3.5V16H7v-3.5L10 9V8L7 4.5V2Zm8 12.75v-1.5L12 9.75l-3 3.5v1.5h6Z" />
      </svg>
    );
  }
  return null;
}

const SidebarStatusBadge = memo(function SidebarStatusBadge({
  status,
  className = "",
}: {
  status: DisplayStatus;
  className?: string;
}) {
  const label = getStatusLabel(status);

  return (
    <span className={`${getStatusClassName(status)} ${className}`.trim()} aria-label={label} title={label}>
      <SidebarStatusGlyph status={status} />
    </span>
  );
});

function SidebarIcon({ name }: { name: "pencil" | "save" | "cancel" | "settings" }) {
  if (name === "pencil") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M4 16.9V20h3.1L17.8 9.3l-3.1-3.1L4 16.9Zm15.8-9.8a1.1 1.1 0 0 0 0-1.6l-1.3-1.3a1.1 1.1 0 0 0-1.6 0l-1 1 3.1 3.1.8-.8Z" />
      </svg>
    );
  }

  if (name === "save") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M5 3h12l2 2v16H5V3Zm3 2v5h8V5H8Zm0 10v4h8v-4H8Z" />
      </svg>
    );
  }

  if (name === "settings") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M19.4 13.5c.1-.5.1-1 .1-1.5s0-1-.1-1.5l2-1.5-2-3.4-2.4 1a7.8 7.8 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.6A7.8 7.8 0 0 0 7 6.6l-2.4-1-2 3.4 2 1.5c-.1.5-.1 1-.1 1.5s0 1 .1 1.5l-2 1.5 2 3.4 2.4-1a7.8 7.8 0 0 0 2.6 1.5l.4 2.6h4l.4-2.6a7.8 7.8 0 0 0 2.6-1.5l2.4 1 2-3.4-2-1.5ZM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="m6.4 5 5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4 6.4 5Z" />
    </svg>
  );
}

function SidebarBookIcon() {
  return (
    <svg className="sidebar-source-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H20v17H7.5A2.5 2.5 0 0 0 5 21.5v-17Zm0 0A2.5 2.5 0 0 1 7.5 7H20" />
    </svg>
  );
}

function SidebarAddRow({
  label,
  isCollapsed,
  onClick,
}: {
  label: string;
  isCollapsed: boolean;
  onClick?: () => void;
}) {
  return (
    <button type="button" className="sidebar-add-row" aria-label={label} onClick={onClick}>
      <span className="sidebar-add-row-plus" aria-hidden="true">+</span>
      {!isCollapsed && <span className="sidebar-add-row-label">{label}</span>}
    </button>
  );
}

function SidebarEditControls({
  isEditMode,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onOpenCourseSettings,
}: {
  isEditMode: boolean;
  onStartEdit?: () => void;
  onCancelEdit?: () => void;
  onSaveEdit?: () => void;
  onOpenCourseSettings?: () => void;
}) {
  if (!isEditMode) {
    return (
      <div className="sidebar-edit-controls">
        <button type="button" className="sidebar-edit-button" aria-label="Edit course" onClick={onStartEdit}>
          <SidebarIcon name="pencil" />
        </button>
      </div>
    );
  }

  return (
    <div className="sidebar-edit-controls sidebar-edit-controls--active">
      <div className="sidebar-edit-control-row">
        <button type="button" className="sidebar-edit-button" aria-label="Cancel course edits" onClick={onCancelEdit}>
          <SidebarIcon name="cancel" />
        </button>
        <button type="button" className="sidebar-edit-button sidebar-edit-button--save" aria-label="Save course edits" onClick={onSaveEdit}>
          <SidebarIcon name="save" />
        </button>
      </div>
      <button type="button" className="sidebar-edit-button sidebar-edit-button--settings" aria-label="Open course settings" onClick={onOpenCourseSettings}>
        <SidebarIcon name="settings" />
      </button>
    </div>
  );
}

function formatModuleHeaderLabel(moduleIndex: number, moduleTitle: string, isCollapsed: boolean) {
  const moduleNumber = moduleIndex + 1;
  const labeledTitle = moduleTitle.match(/^\s*(Module|Week)\s+(\d+)\s*:?\s*(.*)$/i);

  if (labeledTitle) {
    const label = labeledTitle[1][0].toUpperCase() + labeledTitle[1].slice(1).toLowerCase();
    const number = labeledTitle[2];
    const repeatedPrefix = new RegExp(`^${label}\\s+${number}\\s*:?\\s*`, "i");
    const titleWithoutRepeatedPrefix = labeledTitle[3].replace(repeatedPrefix, "").trim();

    if (isCollapsed) {
      return `${label[0]}${number}`;
    }

    return titleWithoutRepeatedPrefix ? `${label} ${number}: ${titleWithoutRepeatedPrefix}` : `${label} ${number}`;
  }

  if (isCollapsed) {
    return `M${moduleNumber}`;
  }

  return `Module ${moduleNumber}: ${moduleTitle}`;
}

const SidebarModuleHeader = memo(function SidebarModuleHeader({
  moduleIndex,
  moduleTitle,
  isExpanded,
  isActiveModule,
  isCollapsed,
  onToggleModule,
}: {
  moduleIndex: number;
  moduleTitle: string;
  isExpanded: boolean;
  isActiveModule: boolean;
  isCollapsed: boolean;
  onToggleModule: (moduleIndex: number) => void;
}) {
  const label = formatModuleHeaderLabel(moduleIndex, moduleTitle, isCollapsed);

  return (
    <button
      type="button"
      className={`module-header ${isExpanded ? "module-header--expanded" : ""} ${
        isActiveModule ? "module-header--active" : ""
      }`}
      onClick={() => onToggleModule(moduleIndex)}
      aria-expanded={isExpanded}
      aria-disabled={isActiveModule}
    >
      <span className="module-header-label">{label}</span>
      <span className="module-header-caret" aria-hidden="true">
        ▾
      </span>
    </button>
  );
});

const SidebarSourceTab = memo(function SidebarSourceTab({
  isActive,
  isCollapsed,
  sourceCount,
  onSelect,
}: {
  isActive: boolean;
  isCollapsed: boolean;
  sourceCount: number;
  onSelect?: () => void;
}) {
  return (
    <button
      type="button"
      className={`module-header sidebar-source-tab ${isActive ? "module-header--active" : ""}`}
      onClick={onSelect}
      aria-current={isActive ? "page" : undefined}
    >
      <span className="module-header-label sidebar-source-label">
        <SidebarBookIcon />
        {!isCollapsed && <span>Sources{sourceCount > 0 ? ` (${sourceCount})` : ""}</span>}
      </span>
    </button>
  );
});

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
          onClick={() => promptForDeleteBlock(() => onDeleteSection?.(section.id), "Delete section", "Are you sure you want to delete this section?")}
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

      
    </aside>
  )
}

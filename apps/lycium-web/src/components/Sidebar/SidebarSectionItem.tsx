import { memo, useCallback, type DragEvent } from "react";
import { SidebarStatusBadge, type DisplayStatus } from "./SidebarPrimitives";
import { DeleteBlockButton, promptForDeleteConfirmation } from "../ContentView/CourseEditControls";
import { sectionLearningType } from "../../utils/coursePresentation";
import { estimateSectionTime, formatCompactTimeEstimate } from "../../utils/curriculumTime";
import type { CourseSection } from "../../courseTypes";

export type SidebarSection = Pick<CourseSection, "id" | "title" | "pageType" | "sectionType" | "estimatedMinutes" | "estimatedHours"> & {
  content: Array<{ type: string }>;
  moduleIndex: number;
  moduleTitle: string;
  displayNumber: string;
};

export default memo(function SidebarSectionItem({
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
  onMoveSection?: (
    sectionId: string,
    targetModuleIndex: number,
    targetSectionIndex: number,
  ) => void;
}) {
  const isLocked = status === "locked";
  const learningType = sectionLearningType(section);
  const timeLabel = formatCompactTimeEstimate(estimateSectionTime(section));
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
        const targetIndex =
          targetSectionIndex + (event.clientY > bounds.top + bounds.height / 2 ? 1 : 0);
        onMoveSection(draggedId, section.moduleIndex, targetIndex);
      }
    },
    [
      draggingSectionId,
      isEditMode,
      onMoveSection,
      section.id,
      section.moduleIndex,
      targetSectionIndex,
    ],
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
      draggable={isEditMode}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragEnd={() => onDragEndSection?.()}
    >
      <button
        type="button"
        className="sidebar-section-button"
        onClick={handleClick}
        disabled={isLocked}
        aria-current={isActive ? "page" : undefined}
      >
        <span className="sidebar-item-number">{section.displayNumber}</span>
        <span className="sidebar-item-label">{isCollapsed ? "" : <><span>{section.title}</span><span className="sidebar-item-meta">{learningType}{timeLabel ? ` · ${timeLabel}` : ""}</span></>}</span>
        {!isEditMode && <SidebarStatusBadge status={status} />}
      </button>
      {isEditMode ? (
        <DeleteBlockButton
          label={`Delete ${section.displayNumber} ${section.title}`}
          onClick={() =>
            promptForDeleteConfirmation(
              () => onDeleteSection?.(section.id),
              "Delete section",
              "Are you sure you want to delete this section?",
            )
          }
        />
      ) : null}
    </div>
  );
});

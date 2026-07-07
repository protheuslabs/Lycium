import { useState } from "react";
import EditableContentBlock from "./EditableContentBlock";
import type {
  ContentBlock,
  ProjectSubmissionStatusHandler,
  QuizProgressStatusHandler,
  QuizSubmissionStatusHandler,
  Section,
  SourceRecord,
} from "./contentViewTypes";
import { projectKeyFor } from "./projectSubmissionStatus";
import type { CourseSourceIndex } from "./sourceCitationUtils";

type EditableSectionContentProps = {
  courseKey: string;
  courseSourceIndex: CourseSourceIndex;
  isEditMode: boolean;
  section: Section;
  sources: SourceRecord[];
  onAddBlock: () => void;
  onBlockChange?: (sectionId: string, blockIndex: number, block: ContentBlock) => void;
  onBlockDelete?: (sectionId: string, blockIndex: number) => void;
  onBlockMove?: (sectionId: string, fromIndex: number, toIndex: number) => void;
  onCitationClick: (citationIndex: number) => void;
  onMissingCitationClick: (blockIndex: number) => void;
  onProjectSubmissionChange: ProjectSubmissionStatusHandler;
  onQuizProgressChange: QuizProgressStatusHandler;
  onQuizSubmissionChange: QuizSubmissionStatusHandler;
};

export function blockDragTargetIndex(
  draggedBlockIndex: number,
  hoveredBlockIndex: number,
  pointerY: number,
  boundsTop: number,
  boundsHeight: number,
) {
  let targetIndex = hoveredBlockIndex + (pointerY > boundsTop + boundsHeight / 2 ? 1 : 0);
  if (draggedBlockIndex < targetIndex) {
    targetIndex -= 1;
  }
  return targetIndex;
}

export default function EditableSectionContent({
  courseKey,
  courseSourceIndex,
  isEditMode,
  section,
  sources,
  onAddBlock,
  onBlockChange,
  onBlockDelete,
  onBlockMove,
  onCitationClick,
  onMissingCitationClick,
  onProjectSubmissionChange,
  onQuizProgressChange,
  onQuizSubmissionChange,
}: EditableSectionContentProps) {
  const [draggedBlockIndex, setDraggedBlockIndex] = useState<number | null>(null);

  return (
    <div className="section-content">
      {section.content.map((block, blockIndex) => (
        <div
          className={`content-block-editor-row ${draggedBlockIndex === blockIndex ? "content-block-editor-row--dragging" : ""}`}
          key={block.type === "project" ? projectKeyFor(courseKey, section.id, block) : `${block.type}-${blockIndex}`}
          onDragOver={(event) => {
            if (!isEditMode) {
              return;
            }

            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            if (draggedBlockIndex === null || draggedBlockIndex === blockIndex) {
              return;
            }

            const bounds = event.currentTarget.getBoundingClientRect();
            const targetIndex = blockDragTargetIndex(
              draggedBlockIndex,
              blockIndex,
              event.clientY,
              bounds.top,
              bounds.height,
            );
            if (targetIndex !== draggedBlockIndex) {
              onBlockMove?.(section.id, draggedBlockIndex, targetIndex);
              setDraggedBlockIndex(targetIndex);
            }
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDraggedBlockIndex(null);
          }}
        >
          {isEditMode && (
            <button
              className="content-block-drag-handle"
              type="button"
              draggable
              aria-label={`Move block ${blockIndex + 1}`}
              title="Drag to reorder block"
              onDragStart={(event) => {
                setDraggedBlockIndex(blockIndex);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", String(blockIndex));
              }}
              onDragEnd={() => setDraggedBlockIndex(null)}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
                <path d="M8 6h.01M12 6h.01M16 6h.01M8 12h.01M12 12h.01M16 12h.01M8 18h.01M12 18h.01M16 18h.01" />
              </svg>
            </button>
          )}
          <EditableContentBlock
            block={block}
            blockIndex={blockIndex}
            courseKey={courseKey}
            sources={sources}
            courseSourceIndex={courseSourceIndex}
            sectionId={section.id}
            isEditMode={isEditMode}
            onBlockChange={onBlockChange}
            onBlockDelete={onBlockDelete}
            onCitationClick={onCitationClick}
            onMissingCitationClick={() => onMissingCitationClick(blockIndex)}
            onQuizSubmissionChange={onQuizSubmissionChange}
            onQuizProgressChange={onQuizProgressChange}
            onProjectSubmissionChange={onProjectSubmissionChange}
          />
        </div>
      ))}
      {isEditMode && (
        <button className="course-edit-add-block" type="button" onClick={onAddBlock}>
          <span className="course-edit-add-block-icon" aria-hidden="true">+</span>
          <span>Add block</span>
        </button>
      )}
    </div>
  );
}

import ProgressMeter from "../ProgressMeter/ProgressMeter";
import { stripModulePrefix } from "../CourseEditing/courseEditPrimitives";
import { EditPencilButton, promptForText } from "./CourseEditControls";
import type { Section } from "./contentViewTypes";

type ReaderHeaderProps = {
  courseKey: string;
  courseTitle: string;
  moduleTitle: string;
  moduleIndex: number;
  section: Section;
  pageType: string;
  progressPercentage: number;
  viewedPercentage: number;
  isEditMode: boolean;
  onCourseTitleChange?: (title: string) => void;
  onModuleTitleChange?: (moduleIndex: number, title: string) => void;
  onSectionTitleChange?: (sectionId: string, title: string) => void;
};

export default function ReaderHeader({
  courseKey,
  courseTitle,
  moduleTitle,
  moduleIndex,
  section,
  pageType,
  progressPercentage,
  viewedPercentage,
  isEditMode,
  onCourseTitleChange,
  onModuleTitleChange,
  onSectionTitleChange,
}: ReaderHeaderProps) {
  const sectionLabel =
    pageType === "apply" ? "Assessment" : section.sectionType === "summary" ? "Review" : "Lesson";

  return (
    <header className="reader-header">
      <p className="course-name course-editable-line">
        <span className="course-editable-line-content">{courseTitle}</span>
        {isEditMode && (
          <EditPencilButton
            label="Edit course title"
            onClick={() =>
              promptForText("Edit course title", courseTitle, (title) =>
                onCourseTitleChange?.(title),
              )
            }
          />
        )}
      </p>
      <div className="module-progress-block">
        <p className="course-title course-editable-line">
          <span className="course-editable-line-content">{moduleTitle}</span>
          {isEditMode && (
            <EditPencilButton
              label="Edit module title"
              onClick={() =>
                promptForText("Edit module title", stripModulePrefix(moduleTitle), (title) =>
                  onModuleTitleChange?.(moduleIndex, title),
                )
              }
            />
          )}
        </p>
      </div>
      <p className="reader-section-label">
        {sectionLabel} {section.displayNumber}
      </p>
      <div className="section-title-row">
        <h1 className="section-title course-editable-line">
          <span className="course-editable-line-content">{section.title}</span>
          {isEditMode && (
            <EditPencilButton
              label="Edit section title"
              onClick={() =>
                promptForText("Edit section title", section.title, (title) =>
                  onSectionTitleChange?.(section.id, title),
                )
              }
            />
          )}
        </h1>
      </div>
      {!isEditMode && (
        <div className="reader-progress" aria-label="Module progress">
          <ProgressMeter
            cacheKey={`content:${courseKey}:${moduleIndex}`}
            progressPercentage={progressPercentage}
            viewedPercentage={viewedPercentage}
          />
        </div>
      )}
    </header>
  );
}

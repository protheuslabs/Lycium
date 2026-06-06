
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ProgressMeter from "../ProgressMeter/ProgressMeter";
import CourseFeedback from "../CourseFeedback/CourseFeedback";
import SourceSuggestionButton from "../CourseFeedback/SourceSuggestionButton";
import CourseNav from "../CourseNav/CourseNav";
import Button from "../Button/Button";
import EditableContentBlock from "./EditableContentBlock";
import { EditPencilButton, promptForBlockType, promptForText, type CourseEditBlockKind } from "./CourseEditControls";
import type { ContentBlock, Section, SourceRecord, QuizProgressStatus, QuizProgressStatusHandler, QuizSubmissionStatusHandler } from "./contentViewTypes";

export type { SourceRecord } from "./contentViewTypes";

type ContentViewProps = {
  courseKey: string;
  courseTitle: string;
  section: Section | null;
  moduleTitle: string;
  moduleIndex: number;
  onNext: () => void;
  onPrev: () => void;
  nextSectionTitle?: string | null;
  isFirstSection: boolean;
  isLastSection: boolean;
  progressPercentage: number;
  viewedPercentage: number;
  markComplete: (sectionId: string) => void;
  isComplete: boolean;
  orderMandatory: boolean;
  onSectionTimedStatusChange?: (sectionId: string, hasTimedQuizInProgress: boolean) => void;
  sources: SourceRecord[];
  isEditMode?: boolean;
  onCourseTitleChange?: (title: string) => void;
  onModuleTitleChange?: (moduleIndex: number, title: string) => void;
  onSectionTitleChange?: (sectionId: string, title: string) => void;
  onBlockChange?: (sectionId: string, blockIndex: number, block: ContentBlock) => void;
  onBlockAdd?: (sectionId: string, block: ContentBlock) => void;
  onBlockDelete?: (sectionId: string, blockIndex: number) => void;
  onBlockMove?: (sectionId: string, fromIndex: number, toIndex: number) => void;
};

function editableModuleTitle(title: string) {
  return title.replace(/^\s*(Module|Week)\s+\d+\s*:?\s*/i, "").trim() || "Module title";
}

function createBlockTemplate(kind: CourseEditBlockKind, initialValue: string): ContentBlock {
  const value = initialValue.trim();

  switch (kind) {
    case "card":
      return {
        type: "conceptCard",
        title: "Concept title",
        description: value || "Lorem ipsum dolor sit amet. Replace this with a concise concept definition.",
        sourceIds: [],
      };
    case "video":
      return {
        type: "video",
        url: value,
        sourceIds: [],
      };
    case "iframe":
      return {
        type: "iframe",
        title: "Embedded resource title",
        url: value,
        sourceIds: [],
      };
    case "heading":
      return {
        type: "heading",
        title: value || "Heading title",
        sourceIds: [],
      };
    case "quiz":
      return {
        type: "quiz",
        title: value || "Quiz title",
        questions: [
          {
            question: "Replace this with the quiz question.",
            options: ["Answer option A", "Answer option B", "Answer option C", "Answer option D"],
            answer: 0,
          },
        ],
        questionsPerAttempt: 1,
        showAnswers: false,
      };
    case "text":
    default:
      return {
        type: "text",
        heading: "Text block title",
        value: value || "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Replace this text with learner-facing instruction.",
        sourceIds: [],
      };
  }
}

export default function ContentView({ 
  courseKey,
  courseTitle,
  section,
  moduleTitle,
  moduleIndex,
  onNext,
  onPrev,
  nextSectionTitle,
  isFirstSection,
  isLastSection,
  progressPercentage,
  viewedPercentage,
  markComplete,
  isComplete,
  orderMandatory,
  onSectionTimedStatusChange,
  sources,
  isEditMode = false,
  onCourseTitleChange,
  onModuleTitleChange,
  onSectionTitleChange,
  onBlockChange,
  onBlockAdd,
  onBlockDelete,
  onBlockMove
}: ContentViewProps) {
  const quizBlockKeys = useMemo(() => {
    if (!section) {
      return [];
    }

    return section.content
      .map((block, idx) => (block.type === "quiz" ? `quiz-${section.id}-${idx}` : null))
      .filter((quizKey): quizKey is string => quizKey !== null);
  }, [section]);

  const [submittedQuizKeys, setSubmittedQuizKeys] = useState<Set<string>>(() => new Set());
  const [quizProgressByKey, setQuizProgressByKey] = useState<Record<string, QuizProgressStatus>>({});
  const [sourcesExpanded, setSourcesExpanded] = useState(false);
  const [draggedBlockIndex, setDraggedBlockIndex] = useState<number | null>(null);
  const citationFocusTimer = useRef<number | null>(null);

  useEffect(() => {
    // Resetting quiz submission state when the learner changes sections is intentional.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSubmittedQuizKeys(new Set());
    setQuizProgressByKey({});
    setSourcesExpanded(false);
    setDraggedBlockIndex(null);
  }, [section?.id]);

  const handleQuizSubmissionChange = useCallback<QuizSubmissionStatusHandler>((quizKey, submitted) => {
    setSubmittedQuizKeys((prev) => {
      if (submitted === prev.has(quizKey)) {
        return prev;
      }

      const next = new Set(prev);

      if (submitted) {
        next.add(quizKey);
      } else {
        next.delete(quizKey);
      }

      return next;
    });
  }, []);

  const handleQuizProgressChange = useCallback<QuizProgressStatusHandler>((quizKey, status) => {
    setQuizProgressByKey((prev) => {
      const existing = prev[quizKey];
      if (
        existing &&
        existing.submitted === status.submitted &&
        existing.inProgress === status.inProgress &&
        existing.timed === status.timed
      ) {
        return prev;
      }

      return {
        ...prev,
        [quizKey]: status,
      };
    });
  }, []);

  const requiresQuizSubmission = quizBlockKeys.length > 0;
  const allRequiredQuizzesSubmitted =
    !requiresQuizSubmission || quizBlockKeys.every((quizKey) => submittedQuizKeys.has(quizKey));
  const hasTimedQuizInProgress = quizBlockKeys.some((quizKey) => {
    const status = quizProgressByKey[quizKey];
    return Boolean(status && status.timed && status.inProgress && !status.submitted);
  });
  const canMarkComplete = !isComplete && allRequiredQuizzesSubmitted;
  const completeButtonTitle = isComplete
    ? "Section complete"
    : requiresQuizSubmission && !allRequiredQuizzesSubmitted
      ? "Submit the quiz before marking this page complete"
      : "Mark section complete";

  const handleInlineCitationClick = useCallback((citationIndex: number) => {
    if (!section?.id) {
      return;
    }

    setSourcesExpanded(true);
    if (citationFocusTimer.current !== null) {
      window.clearTimeout(citationFocusTimer.current);
    }
    citationFocusTimer.current = window.setTimeout(() => {
      const target = document.getElementById(`source-reference-${section.id}-${citationIndex}`);
      if (!target) {
        return;
      }
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.focus({ preventScroll: true });
    }, 0);
  }, [section?.id]);

  const handleAddBlock = useCallback(() => {
    if (!section?.id) {
      return;
    }

    promptForBlockType((kind, initialValue) => onBlockAdd?.(section.id, createBlockTemplate(kind, initialValue)));
  }, [onBlockAdd, section?.id]);

  useEffect(() => {
    if (!section?.id) {
      return;
    }

    onSectionTimedStatusChange?.(section.id, hasTimedQuizInProgress);
  }, [hasTimedQuizInProgress, onSectionTimedStatusChange, section?.id]);

  if (!section) {
    return (
      <main className="content-view">
        <h1 className="course-title">{moduleTitle}</h1>
        <p className="section-content">No section selected.</p>
      </main>
    );
  }

  const sectionSources = getSectionSources(section, sources);
  const pageType = getPageType(section);

  
  return (
    <main className={`content-view content-view--${pageType}`} data-module-index={moduleIndex}>
      <p className="course-name course-editable-line">
        <span className="course-editable-line-content">{courseTitle}</span>
        {isEditMode && (
          <EditPencilButton
            label="Edit course title"
            onClick={() => promptForText("Edit course title", courseTitle, (title) => onCourseTitleChange?.(title))}
          />
        )}
      </p>
      <div className="module-progress-block">
        <h1 className="course-title course-editable-line">
          <span className="course-editable-line-content">{moduleTitle}</span>
          {isEditMode && (
              <EditPencilButton
                label="Edit module title"
                onClick={() => promptForText("Edit module title", editableModuleTitle(moduleTitle), (title) => onModuleTitleChange?.(moduleIndex, title))}
              />
          )}
        </h1>
        {!isEditMode && (
          <ProgressMeter
            cacheKey={`content:${courseTitle}:${moduleIndex}`}
            progressPercentage={progressPercentage}
            viewedPercentage={viewedPercentage}
          />
        )}
      </div>
      
      {/* Section Title With Decimal */}
      <h2 className="section-title course-editable-line">
        <span className="course-editable-line-content">{section.displayNumber} {section.title}</span>
        {isEditMode && (
          <EditPencilButton
            label="Edit section title"
            onClick={() => promptForText("Edit section title", section.title, (title) => onSectionTitleChange?.(section.id, title))}
          />
        )}
      </h2>
      <div className="section-content">
        {Array.isArray(section.content)
          ? section.content.map((block, idx) => (
              <div
                className={`content-block-editor-row ${draggedBlockIndex === idx ? "content-block-editor-row--dragging" : ""}`}
                key={`${block.type}-${idx}`}
                onDragOver={(event) => {
                  if (isEditMode) {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    if (draggedBlockIndex !== null && draggedBlockIndex !== idx) {
                      onBlockMove?.(section.id, draggedBlockIndex, idx);
                      setDraggedBlockIndex(idx);
                    }
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
                    aria-label={`Move block ${idx + 1}`}
                    title="Drag to reorder block"
                    onDragStart={(event) => {
                      setDraggedBlockIndex(idx);
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", String(idx));
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
                  blockIndex={idx}
                  sources={sources}
                  sectionId={section.id}
                  isEditMode={isEditMode}
                  onBlockChange={onBlockChange}
                  onBlockDelete={onBlockDelete}
                  onCitationClick={handleInlineCitationClick}
                  onQuizSubmissionChange={handleQuizSubmissionChange}
                  onQuizProgressChange={handleQuizProgressChange}
                />
              </div>
            ))
          : <p>{section.content}</p> /* fallback for old data */}
        {isEditMode && (
          <button className="course-edit-add-block" type="button" onClick={handleAddBlock}>
            <span className="course-edit-add-block-icon" aria-hidden="true">+</span>
            <span>Add block</span>
          </button>
        )}
      </div>

      <CourseNav
        centerControls={<CourseFeedback courseKey={courseKey} courseTitle={courseTitle} />}
        nextSectionTitle={nextSectionTitle}
        isFirstSection={isFirstSection}
        isLastSection={isLastSection}
        nextDisabled={Boolean(orderMandatory) && !isComplete}
        isComplete={isComplete}
        canMarkComplete={canMarkComplete}
        allRequiredQuizzesSubmitted={allRequiredQuizzesSubmitted}
        completeButtonTitle={completeButtonTitle}
        onPrev={onPrev}
        onNext={onNext}
        onComplete={() => markComplete(section.id)}
      />

      {sectionSources.length > 0 && (
        <section className="source-reference-list" aria-label="Sources">
          <div className="source-reference-controls">
            <Button
              type="button"
              variant="nav"
              className={`source-reference-toggle ${sourcesExpanded ? "source-reference-toggle-expanded" : ""}`}
              aria-expanded={sourcesExpanded}
              onClick={() => setSourcesExpanded((expanded) => !expanded)}
            >
              <span>Sources{sourcesExpanded ? "" : ` (${sectionSources.length})`}</span>
              <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
                <path d="M8 5l8 7-8 7" />
              </svg>
            </Button>
            <SourceSuggestionButton courseKey={courseKey} courseTitle={courseTitle} />
          </div>
          {sourcesExpanded && (
            <ul>
              {sectionSources.map((source, index) => (
                <li
                  id={`source-reference-${section.id}-${index + 1}`}
                  key={source.id}
                  tabIndex={-1}
                >
                  <span className="source-reference-index">[{index + 1}]</span>
                  {source.url ? (
                    <a href={source.url} target="_blank" rel="noreferrer">
                      {source.title}
                    </a>
                  ) : (
                    <span>{source.title}</span>
                  )}
                  {source.publisher && <span> - {source.publisher}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </main>
  );
  
}

function getSourcesByIds(sourceIds: string[] | undefined, sources: SourceRecord[]) {
  if (!Array.isArray(sourceIds) || sourceIds.length === 0) {
    return [];
  }

  const sourceMap = new Map(sources.map((source) => [source.id, source]));
  return sourceIds
    .map((sourceId) => sourceMap.get(sourceId))
    .filter((source): source is SourceRecord => Boolean(source));
}

function getSectionSources(section: Section, sources: SourceRecord[]) {
  const sourceIds = new Set(section.sourceIds ?? []);

  for (const block of section.content) {
    for (const sourceId of block.sourceIds ?? []) {
      sourceIds.add(sourceId);
    }
  }

  return getSourcesByIds(Array.from(sourceIds), sources);
}

function getPageType(section: Section) {
  if (section.pageType === "learn" || section.pageType === "apply") {
    return section.pageType;
  }

  if (
    section.sectionType === "assessment" ||
    section.content.every((block) => block.type === "quiz")
  ) {
    return "apply";
  }

  return "learn";
}

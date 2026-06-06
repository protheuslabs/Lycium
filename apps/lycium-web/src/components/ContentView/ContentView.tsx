
import { useCallback, useEffect, useMemo, useState } from "react";
import ProgressMeter from "../ProgressMeter/ProgressMeter";
import CourseFeedback from "../CourseFeedback/CourseFeedback";
import SourceSuggestionButton from "../CourseFeedback/SourceSuggestionButton";
import CourseNav from "../CourseNav/CourseNav";
import Button from "../Button/Button";
import EditableContentBlock from "./EditableContentBlock";
import { EditPencilButton, promptForText } from "./CourseEditControls";
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
};

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
  onBlockChange
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

  useEffect(() => {
    // Resetting quiz submission state when the learner changes sections is intentional.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSubmittedQuizKeys(new Set());
    setQuizProgressByKey({});
    setSourcesExpanded(false);
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
        <span>{courseTitle}</span>
        {isEditMode && (
          <EditPencilButton
            label="Edit course title"
            onClick={() => promptForText("Edit course title", courseTitle, (title) => onCourseTitleChange?.(title))}
          />
        )}
      </p>
      <div className="module-progress-block">
        <h1 className="course-title course-editable-line">
          <span>{moduleTitle}</span>
          {isEditMode && (
            <EditPencilButton
              label="Edit module title"
              onClick={() => promptForText("Edit module title", moduleTitle, (title) => onModuleTitleChange?.(moduleIndex, title))}
            />
          )}
        </h1>
        <ProgressMeter
          cacheKey={`content:${courseTitle}:${moduleIndex}`}
          progressPercentage={progressPercentage}
          viewedPercentage={viewedPercentage}
        />
      </div>
      
      {/* Section Title With Decimal */}
      <h2 className="section-title course-editable-line">
        <span>{section.displayNumber} {section.title}</span>
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
              <EditableContentBlock
                key={idx}
                block={block}
                blockIndex={idx}
                sources={sources}
                sectionId={section.id}
                isEditMode={isEditMode}
                onBlockChange={onBlockChange}
                onQuizSubmissionChange={handleQuizSubmissionChange}
                onQuizProgressChange={handleQuizProgressChange}
              />
            ))
          : <p>{section.content}</p> /* fallback for old data */}
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
                <li key={source.id}>
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

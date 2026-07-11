
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import ProgressMeter from "../ProgressMeter/ProgressMeter";
import CourseFeedback from "../CourseFeedback/CourseFeedback";
import SourceSuggestionButton from "../CourseFeedback/SourceSuggestionButton";
import CourseNav from "../CourseNav/CourseNav";
import Button from "../Button/Button";
import Modal from "../Modal/Modal";
import CourseSourcesPage from "./CourseSourcesPage";
import EditableSectionContent from "./EditableSectionContent";
import SectionRefreshControl from "./SectionRefreshControl";
import { EditPencilButton, promptForBlockType, promptForText } from "./CourseEditControls";
import type { ContentBlock, Section, SourceRecord } from "./contentViewTypes";
import { buildCourseSourceIndex, getSectionSources, sourceCitationNumber } from "./sourceCitationUtils";
import { createBlockTemplate, stripModulePrefix } from "../CourseEditing/courseEditPrimitives";
import { useSectionQuizStatus } from "./useSectionQuizStatus";
import { hasSubmittedProject, projectKeyFor } from "./projectSubmissionStatus";

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
  showCourseSourcesPage?: boolean;
  hasIncompleteSources?: boolean;
  isEditMode?: boolean;
  onCourseTitleChange?: (title: string) => void;
  onModuleTitleChange?: (moduleIndex: number, title: string) => void;
  onSectionTitleChange?: (sectionId: string, title: string) => void;
  onBlockChange?: (sectionId: string, blockIndex: number, block: ContentBlock) => void;
  onBlockAdd?: (sectionId: string, block: ContentBlock) => void;
  onBlockDelete?: (sectionId: string, blockIndex: number) => void;
  onBlockMove?: (sectionId: string, fromIndex: number, toIndex: number) => void;
  onSourceCreate?: (sourceUrl: string) => SourceRecord | null;
  canRegenerateSection?: boolean;
  sectionRefreshLockedReason?: string;
  sectionRefreshLockedAction?: "settings" | null;
  onRegenerateSection?: (payload: {
    feedback?: string;
    positiveFeedback?: string[];
    negativeFeedback?: string[];
    newSourceUrls?: string[];
    badSourceIds?: string[];
  }) => Promise<unknown> | unknown;
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
  showCourseSourcesPage = false,
  hasIncompleteSources = false,
  isEditMode = false,
  onCourseTitleChange,
  onModuleTitleChange,
  onSectionTitleChange,
  onBlockChange,
  onBlockAdd,
  onBlockDelete,
  onBlockMove,
  onSourceCreate,
  canRegenerateSection = false,
  sectionRefreshLockedReason,
  sectionRefreshLockedAction = null,
  onRegenerateSection
}: ContentViewProps) {
  const [sourcesExpanded, setSourcesExpanded] = useState(false);
  const [sourceTarget, setSourceTarget] = useState<{ sectionId: string; blockIndex: number } | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceStatus, setSourceStatus] = useState("");
  const citationFocusTimer = useRef<number | null>(null);
  const courseSourceIndex = useMemo(() => buildCourseSourceIndex(sources), [sources]);
  const projectBlockKeys = useMemo(() => {
    if (!section) {
      return [];
    }

    return section.content
      .map((block) => (block.type === "project" ? projectKeyFor(courseKey, section.id, block) : null))
      .filter((projectKey): projectKey is string => projectKey !== null);
  }, [courseKey, section]);
  const [submittedProjectKeys, setSubmittedProjectKeys] = useState<Set<string>>(
    () => new Set(projectBlockKeys.filter(hasSubmittedProject)),
  );
  const requiresProjectSubmission = projectBlockKeys.length > 0;
  const allRequiredProjectsSubmitted =
    !requiresProjectSubmission || projectBlockKeys.every((projectKey) => submittedProjectKeys.has(projectKey));
  const {
    allRequiredQuizzesSubmitted,
    canMarkComplete,
    completeButtonTitle,
    handleQuizProgressChange,
    handleQuizSubmissionChange,
    requiresQuizSubmission,
  } = useSectionQuizStatus({
    section,
    isComplete,
    onQuizSectionPassed: markComplete,
    onSectionTimedStatusChange,
    autoCompleteEnabled: allRequiredProjectsSubmitted,
  });
  const completionRequirementsMet = allRequiredQuizzesSubmitted && allRequiredProjectsSubmitted;
  const canMarkSectionComplete = canMarkComplete && allRequiredProjectsSubmitted;
  const sectionCompleteButtonTitle = isComplete
    ? "Section complete"
    : !allRequiredProjectsSubmitted
      ? "Submit the project to complete this page"
      : completeButtonTitle;

  useEffect(() => {
    if (section?.id && requiresProjectSubmission && allRequiredProjectsSubmitted && !requiresQuizSubmission && !isComplete) {
      markComplete(section.id);
    }
  }, [allRequiredProjectsSubmitted, isComplete, markComplete, requiresProjectSubmission, requiresQuizSubmission, section?.id]);

  const handleProjectSubmissionChange = useCallback((projectKey: string, submitted: boolean) => {
    setSubmittedProjectKeys((previous) => {
      if (submitted === previous.has(projectKey)) {
        return previous;
      }

      const next = new Set(previous);
      if (submitted) {
        next.add(projectKey);
      } else {
        next.delete(projectKey);
      }
      return next;
    });
  }, []);

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
  }, [section]);

  const handleAddBlock = useCallback(() => {
    if (!section?.id) {
      return;
    }

    promptForBlockType((kind, initialValue) => onBlockAdd?.(section.id, createBlockTemplate(kind, initialValue)));
  }, [onBlockAdd, section]);

  const handleAttachSource = useCallback(
    (sourceId: string) => {
      if (!section || !sourceTarget || sourceTarget.sectionId !== section.id) {
        return;
      }

      const block = section.content[sourceTarget.blockIndex];

      if (!block) {
        return;
      }

      onBlockChange?.(section.id, sourceTarget.blockIndex, {
        ...block,
        sourceIds: [sourceId],
      });
      setSourceTarget(null);
      setSourceUrl("");
      setSourceStatus("");
    },
    [onBlockChange, section, sourceTarget],
  );

  const handleSubmitNewSource = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const cleanUrl = sourceUrl.trim();

      if (!cleanUrl) {
        return;
      }

      const source = onSourceCreate?.(cleanUrl);

      if (!source) {
        setSourceStatus("Source could not be created yet.");
        return;
      }

      handleAttachSource(source.id);
    },
    [handleAttachSource, onSourceCreate, sourceUrl],
  );


  if (!section) {
    if (showCourseSourcesPage) {
      return (
        <CourseSourcesPage
          courseKey={courseKey}
          courseTitle={courseTitle}
          sources={sources}
          courseSourceIndex={courseSourceIndex}
        />
      );
    }

    return (
      <main className="content-view">
        <h1 className="course-title">{moduleTitle}</h1>
        <p className="section-content">No section selected.</p>
      </main>
    );
  }

  if (showCourseSourcesPage) {
    return (
      <CourseSourcesPage
        courseKey={courseKey}
        courseTitle={courseTitle}
        sources={sources}
        courseSourceIndex={courseSourceIndex}
      />
    );
  }

  const sectionSources = getSectionSources(section, sources, courseSourceIndex);
  const pageType = getPageType(section);

  
  return (
    <main className={`content-view content-view--${pageType}`} data-module-index={moduleIndex}>
      {hasIncompleteSources && (
        <div className="course-source-notice" role="status">
          <strong>Sources incomplete</strong>
          <span>Some sections may be missing supporting evidence. You can still use the course.</span>
        </div>
      )}
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
                onClick={() => promptForText("Edit module title", stripModulePrefix(moduleTitle), (title) => onModuleTitleChange?.(moduleIndex, title))}
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
      <div className="section-title-row">
        <h2 className="section-title course-editable-line">
          <span className="course-editable-line-content">{section.displayNumber} {section.title}</span>
          {isEditMode && (
            <EditPencilButton
              label="Edit section title"
              onClick={() => promptForText("Edit section title", section.title, (title) => onSectionTitleChange?.(section.id, title))}
            />
          )}
        </h2>
      </div>
      {Array.isArray(section.content) ? (
        <EditableSectionContent
          courseKey={courseKey}
          courseSourceIndex={courseSourceIndex}
          isEditMode={isEditMode}
          section={section}
          sources={sources}
          onAddBlock={handleAddBlock}
          onBlockChange={onBlockChange}
          onBlockDelete={onBlockDelete}
          onBlockMove={onBlockMove}
          onCitationClick={handleInlineCitationClick}
          onMissingCitationClick={(blockIndex) => setSourceTarget({ sectionId: section.id, blockIndex })}
          onProjectSubmissionChange={handleProjectSubmissionChange}
          onQuizProgressChange={handleQuizProgressChange}
          onQuizSubmissionChange={handleQuizSubmissionChange}
        />
      ) : (
        <div className="section-content"><p>{section.content}</p></div>
      )}

      <CourseNav
        centerControls={(
          <>
            <CourseFeedback courseKey={courseKey} courseTitle={courseTitle} />
            {!isEditMode && onRegenerateSection && (
              <SectionRefreshControl
                canRegenerateSection={canRegenerateSection}
                lockedReason={sectionRefreshLockedReason}
                lockedAction={sectionRefreshLockedAction}
                onRegenerateSection={onRegenerateSection}
              />
            )}
          </>
        )}
        nextSectionTitle={nextSectionTitle}
        isFirstSection={isFirstSection}
        isLastSection={isLastSection}
        nextDisabled={Boolean(orderMandatory) && !isComplete}
        isComplete={isComplete}
        canMarkComplete={canMarkSectionComplete}
        completionRequirementsMet={completionRequirementsMet}
        completeButtonTitle={sectionCompleteButtonTitle}
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
              {sectionSources.map((source) => {
                const citationIndex = sourceCitationNumber(source.id, courseSourceIndex);

                return (
                  <li
                    id={`source-reference-${section.id}-${citationIndex ?? source.id}`}
                    key={source.id}
                    tabIndex={-1}
                  >
                    <span className="source-reference-index">[{citationIndex ?? "?"}]</span>
                    {source.url ? (
                      <a href={source.url} target="_blank" rel="noreferrer">
                        {source.title}
                      </a>
                    ) : (
                      <span>{source.title}</span>
                    )}
                    {source.publisher && <span> - {source.publisher}</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      <Modal
        isOpen={Boolean(sourceTarget)}
        title="Add a source for this course"
        eyebrow="Block citation"
        labelledById="block-source-modal-title"
        size="md"
        onClose={() => {
          setSourceTarget(null);
          setSourceUrl("");
          setSourceStatus("");
        }}
      >
        <form className="block-source-form" onSubmit={handleSubmitNewSource}>
          <label>
            <span>Source URL</span>
            <input
              type="url"
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)}
              placeholder="https://example.edu/source"
            />
          </label>
          <div className="block-source-form-footer">
            {sourceStatus && <p>{sourceStatus}</p>}
            <Button type="submit" variant="standard" disabled={!sourceUrl.trim()}>
              Add URL source
            </Button>
          </div>
        </form>

        {sources.length > 0 && (
          <div className="block-source-existing">
            <p>Or connect an existing course source</p>
            <div className="block-source-existing-list">
              {sources.map((source) => {
                const citationIndex = sourceCitationNumber(source.id, courseSourceIndex);

                return (
                  <div className="block-source-existing-row" key={source.id}>
                    <button type="button" onClick={() => handleAttachSource(source.id)}>
                      <span className="source-reference-index">[{citationIndex ?? "?"}]</span>
                      <span>{source.title}</span>
                    </button>
                    {source.url && (
                      <a href={source.url} target="_blank" rel="noreferrer" aria-label={`Open ${source.title}`}>
                        <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
                          <path d="M8 5l8 7-8 7" />
                        </svg>
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Modal>

    </main>
  );
  
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

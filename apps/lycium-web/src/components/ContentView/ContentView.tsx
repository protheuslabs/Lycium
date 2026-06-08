
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import ProgressMeter from "../ProgressMeter/ProgressMeter";
import CourseFeedback from "../CourseFeedback/CourseFeedback";
import SourceSuggestionButton from "../CourseFeedback/SourceSuggestionButton";
import CourseNav from "../CourseNav/CourseNav";
import Button from "../Button/Button";
import Modal from "../Modal/Modal";
import CourseSourcesPage from "./CourseSourcesPage";
import EditableContentBlock from "./EditableContentBlock";
import { EditPencilButton, promptForBlockType, promptForText } from "./CourseEditControls";
import type { ContentBlock, Section, SourceRecord } from "./contentViewTypes";
import { buildCourseSourceIndex, getSectionSources, sourceCitationNumber } from "./sourceCitationUtils";
import { createBlockTemplate, stripModulePrefix } from "../CourseEditing/courseEditPrimitives";
import { useSectionQuizStatus } from "./useSectionQuizStatus";

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
  onRegenerateSection
}: ContentViewProps) {
  const [sourcesExpanded, setSourcesExpanded] = useState(false);
  const [draggedBlockIndex, setDraggedBlockIndex] = useState<number | null>(null);
  const [sourceTarget, setSourceTarget] = useState<{ sectionId: string; blockIndex: number } | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceStatus, setSourceStatus] = useState("");
  const [isRefreshOpen, setIsRefreshOpen] = useState(false);
  const [refreshFeedback, setRefreshFeedback] = useState("");
  const [positiveFeedback, setPositiveFeedback] = useState("");
  const [negativeFeedback, setNegativeFeedback] = useState("");
  const [refreshSourceUrls, setRefreshSourceUrls] = useState("");
  const [badSourceIds, setBadSourceIds] = useState<Set<string>>(new Set());
  const [refreshStatus, setRefreshStatus] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const citationFocusTimer = useRef<number | null>(null);
  const courseSourceIndex = useMemo(() => buildCourseSourceIndex(sources), [sources]);
  const {
    allRequiredQuizzesSubmitted,
    canMarkComplete,
    completeButtonTitle,
    handleQuizProgressChange,
    handleQuizSubmissionChange,
  } = useSectionQuizStatus({ section, isComplete, onSectionTimedStatusChange });

  useEffect(() => {
    setSourcesExpanded(false);
    setDraggedBlockIndex(null);
    setSourceTarget(null);
    setSourceUrl("");
    setSourceStatus("");
    setIsRefreshOpen(false);
    setRefreshStatus("");
    setBadSourceIds(new Set());
  }, [section?.id]);

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

  const splitLines = (value: string) =>
    value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

  const handleRefreshSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!onRegenerateSection || !section) {
        return;
      }

      setIsRefreshing(true);
      setRefreshStatus("Refreshing this section...");
      try {
        await onRegenerateSection({
          feedback: refreshFeedback,
          positiveFeedback: splitLines(positiveFeedback),
          negativeFeedback: splitLines(negativeFeedback),
          newSourceUrls: splitLines(refreshSourceUrls),
          badSourceIds: Array.from(badSourceIds),
        });
        setIsRefreshOpen(false);
        setRefreshStatus("");
      } catch (err) {
        setRefreshStatus(err instanceof Error ? err.message : "Section refresh failed.");
      } finally {
        setIsRefreshing(false);
      }
    },
    [badSourceIds, negativeFeedback, onRegenerateSection, positiveFeedback, refreshFeedback, refreshSourceUrls, section],
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
        {!isEditMode && onRegenerateSection && (
          <Button
            type="button"
            variant="icon"
            iconOnly
            className="section-refresh-button"
            disabled={!canRegenerateSection || isRefreshing}
            title={canRegenerateSection ? "Refresh this section with AI" : "Section refresh needs an API-backed snapshot and verified AI model"}
            aria-label="Refresh this section with AI"
            onClick={() => setIsRefreshOpen(true)}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
              <path d="M20 6v5h-5" />
              <path d="M4 18v-5h5" />
              <path d="M18.5 9A7 7 0 0 0 6.4 6.7L4 9" />
              <path d="M5.5 15a7 7 0 0 0 12.1 2.3L20 15" />
            </svg>
          </Button>
        )}
      </div>
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
                      const bounds = event.currentTarget.getBoundingClientRect();
                      let targetIndex = idx + (event.clientY > bounds.top + bounds.height / 2 ? 1 : 0);
                      if (draggedBlockIndex < targetIndex) {
                        targetIndex -= 1;
                      }
                      if (targetIndex !== draggedBlockIndex) {
                        onBlockMove?.(section.id, draggedBlockIndex, targetIndex);
                        setDraggedBlockIndex(targetIndex);
                      }
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
                  courseSourceIndex={courseSourceIndex}
                  sectionId={section.id}
                  isEditMode={isEditMode}
                  onBlockChange={onBlockChange}
                  onBlockDelete={onBlockDelete}
                  onCitationClick={handleInlineCitationClick}
                  onMissingCitationClick={() => setSourceTarget({ sectionId: section.id, blockIndex: idx })}
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

      <Modal
        isOpen={isRefreshOpen}
        title="Refresh this section"
        eyebrow="AI section revision"
        labelledById="section-refresh-modal-title"
        size="md"
        onClose={() => {
          if (!isRefreshing) {
            setIsRefreshOpen(false);
            setRefreshStatus("");
          }
        }}
      >
        <form className="section-refresh-form" onSubmit={handleRefreshSubmit}>
          <label>
            <span>Overall direction</span>
            <textarea
              value={refreshFeedback}
              onChange={(event) => setRefreshFeedback(event.target.value)}
              placeholder="What should the model improve or preserve in this section?"
              disabled={isRefreshing}
            />
          </label>
          <label>
            <span>Keep or strengthen</span>
            <textarea
              value={positiveFeedback}
              onChange={(event) => setPositiveFeedback(event.target.value)}
              placeholder="One positive note per line"
              disabled={isRefreshing}
            />
          </label>
          <label>
            <span>Fix or avoid</span>
            <textarea
              value={negativeFeedback}
              onChange={(event) => setNegativeFeedback(event.target.value)}
              placeholder="One negative note per line"
              disabled={isRefreshing}
            />
          </label>
          <label>
            <span>New sources</span>
            <textarea
              value={refreshSourceUrls}
              onChange={(event) => setRefreshSourceUrls(event.target.value)}
              placeholder="https://example.edu/source&#10;https://openstax.org/..."
              disabled={isRefreshing}
            />
          </label>

          {sectionSources.length > 0 && (
            <fieldset className="section-refresh-source-fieldset">
              <legend>Sources to avoid</legend>
              {sectionSources.map((source) => {
                const citationIndex = sourceCitationNumber(source.id, courseSourceIndex);
                const checked = badSourceIds.has(source.id);

                return (
                  <label className="section-refresh-source-row" key={source.id}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={isRefreshing}
                      onChange={(event) =>
                        setBadSourceIds((current) => {
                          const next = new Set(current);
                          if (event.target.checked) {
                            next.add(source.id);
                          } else {
                            next.delete(source.id);
                          }
                          return next;
                        })
                      }
                    />
                    <span>[{citationIndex ?? "?"}] {source.title}</span>
                  </label>
                );
              })}
            </fieldset>
          )}

          <div className="section-refresh-footer">
            {refreshStatus && <p>{refreshStatus}</p>}
            <Button type="submit" variant="standard" disabled={isRefreshing || !canRegenerateSection}>
              {isRefreshing ? "Refreshing..." : "Refresh section"}
            </Button>
          </div>
        </form>
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

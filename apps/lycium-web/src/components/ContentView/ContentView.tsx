
import { useCallback, useEffect, useMemo, useState } from "react";
import ProgressMeter from "../ProgressMeter/ProgressMeter";
import CourseFeedback from "../CourseFeedback/CourseFeedback";
import CourseNav from "../CourseNav/CourseNav";
import Button from "../Button/Button";
import QuizBlock from "../Quiz/QuizBlock";
import VideoBlock from "../Video/VideoBlock";

type ConceptCard = {
  name?: string;
  description?: string;
  title?: string;
  heading?: string;
  body?: string;
  value?: string;
  text?: string;
  sourceIds?: string[];
};

type ContentBlock = {
  type: string;
  value?: string;
  text?: string;
  heading?: string;
  title?: string;
  url?: string;
  sourceIds?: string[];
  cards?: Array<ConceptCard | string>;
  concepts?: Array<ConceptCard | string>;
  question?: string;
  questions?: Array<{
    question?: string;
    options?: string[];
    answer?: number;
    answers?: number[];
    timed?: "t" | "f" | boolean;
  }>;
  questionBank?: unknown;
  question_bank?: unknown;
  questionsPerAttempt?: number | string;
  questions_per_attempt?: number | string;
  questionCount?: number | string;
  question_count?: number | string;
  options?: string[];
  answer?: number;
  answers?: number[];
  name?: string;
  description?: string;
  timed?: "t" | "f" | boolean;
  maxAttempts?: number | string;
  max_attempts?: number | string;
  attemptLimit?: number | string;
  attempt_limit?: number | string;
  timeLimit?: number | string;
  time_limit?: number | string;
  timeLimitSeconds?: number | string;
  time_limit_seconds?: number | string;
  passPercentage?: number | string;
  pass_percentage?: number | string;
  passPercent?: number | string;
  pass_percent?: number | string;
  showAnswers?: boolean | string;
  show_answers?: boolean | string;
  showCorrectAnswers?: boolean | string;
  show_correct_answers?: boolean | string;
};

type Section = {
  id: string;
  title: string;
  content: ContentBlock[];
  displayNumber: string;
  sectionType?: string;
  pageType?: "learn" | "apply";
  sourceIds?: string[];
};

type SourceRecord = {
  id: string;
  type: string;
  title: string;
  author?: string;
  publisher?: string;
  url?: string;
  embedUrl?: string;
  localPath?: string;
  usedByCourseIds?: string[];
  usedByCourseTitles?: string[];
};

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
};

type QuizSubmissionStatusHandler = (quizKey: string, submitted: boolean) => void;
type QuizProgressStatus = {
  submitted: boolean;
  inProgress: boolean;
  timed: boolean;
};
type QuizProgressStatusHandler = (quizKey: string, status: QuizProgressStatus) => void;

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
  sources
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
      <p className="course-name">{courseTitle}</p>
      <div className="module-progress-block">
        <h1 className="course-title">{moduleTitle}</h1>
        <ProgressMeter
          cacheKey={`content:${courseTitle}:${moduleIndex}`}
          progressPercentage={progressPercentage}
          viewedPercentage={viewedPercentage}
        />
      </div>
      
      {/* Section Title With Decimal */}
      <h2 className="section-title">
        {section.displayNumber} {section.title}
      </h2>
      <div className="section-content">
        {Array.isArray(section.content)
          ? section.content.map((block, idx) =>
              renderContentBlock(
                block,
                idx,
                sources,
                section.id,
                handleQuizSubmissionChange,
                handleQuizProgressChange
              )
            )
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

// Render a normalized course content block.
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

function renderContentBlock(
  item: ContentBlock,
  key: number,
  sources: SourceRecord[],
  sectionId: string,
  onQuizSubmissionChange: QuizSubmissionStatusHandler,
  onQuizProgressChange: QuizProgressStatusHandler
) {
  const blockSources = getSourcesByIds(item.sourceIds, sources);

  switch (item.type) {
    case "text":
      return (
        <div key={key} className="text-block">
          {item.heading && <h3>{item.heading}</h3>}
          {(item.value || item.text) && <p>{item.value || item.text}</p>}
        </div>
        )

    case "conceptCards":
    case "concept_cards":
      return renderConceptCards(item, key);

    case "video": {
      const videoSource = blockSources.find((source) => source.embedUrl) ?? blockSources[0];
      const videoUrl = item.url ?? videoSource?.embedUrl ?? videoSource?.url;

      if (!videoUrl) {
        return (
          <p key={key} className="source-missing">
            Video source unavailable.
          </p>
        );
      }

      return (
        <VideoBlock key={key} url={videoUrl} title={videoSource?.title ?? "Video content"} />
      );
    }
      
    case "quiz": {
      const quizKey = `quiz-${sectionId}-${key}`;
      return (
        <QuizBlock
          key={key}
          data={item}
          name={quizKey}
          onSubmissionChange={onQuizSubmissionChange}
          onProgressChange={onQuizProgressChange}
        />
      );
    }
      
      case "game":
        return (
          <div key={key} className="game-block">
            <p><strong>Game:</strong> {item.name || "Unnamed game"}</p>
            {item.description && <p>{item.description}</p>}
          </div>
        );
      
      default:
        return <p key={key}>Unknown content type</p>;
  }
}

function renderConceptCards(item: ContentBlock, key: number) {
  const cards = item.concepts ?? item.cards ?? [];

  if (cards.length === 0) {
    return null;
  }

  return (
    <section key={key} className="concept-card-stack" aria-label={item.title ?? "Concept cards"}>
      {item.title && <h3 className="concept-card-stack-title">{item.title}</h3>}
      {cards.map((card, idx) => {
        const title =
          typeof card === "string"
            ? card
            : card.name ?? card.title ?? card.heading ?? `Concept ${idx + 1}`;
        const body =
          typeof card === "string"
            ? undefined
            : card.description ?? card.body ?? card.value ?? card.text;

        return (
          <article className="concept-card" key={`${title}-${idx}`}>
            <h4>{title}</h4>
            {body && <p>{body}</p>}
          </article>
        );
      })}
    </section>
  );
}


import { useCallback, useEffect, useMemo, useState } from "react";
import "./contentView.css";
import QuizBlock from "../Quiz/QuizBlock";

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
  courseTitle: string;
  section: Section | null;
  moduleTitle: string;
  moduleIndex: number;
  onNext: () => void;
  onPrev: () => void;
  isFirstSection: boolean;
  isLastSection: boolean;
  progressPercentage: number;
  markComplete: (sectionId: string) => void;
  isComplete: boolean;
  orderMandatory: boolean;
  sources: SourceRecord[];
};

type QuizSubmissionStatusHandler = (quizKey: string, submitted: boolean) => void;

export default function ContentView({ 
  courseTitle,
  section,
  moduleTitle,
  moduleIndex: _moduleIndex,
  onNext,
  onPrev,
  isFirstSection,
  isLastSection,
  progressPercentage,
  markComplete,
  isComplete,
  orderMandatory,
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

  useEffect(() => {
    setSubmittedQuizKeys(new Set());
  }, [section?.id]);

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
  const requiresQuizSubmission = quizBlockKeys.length > 0;
  const allRequiredQuizzesSubmitted =
    !requiresQuizSubmission || quizBlockKeys.every((quizKey) => submittedQuizKeys.has(quizKey));
  const canMarkComplete = !isComplete && allRequiredQuizzesSubmitted;
  const completeButtonTitle = isComplete
    ? "Section complete"
    : requiresQuizSubmission && !allRequiredQuizzesSubmitted
      ? "Submit the quiz before marking this page complete"
      : "Mark section complete";
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

  
  return (
    <main className={`content-view content-view--${pageType}`}>
      <p className="course-name">{courseTitle}</p>
      <div className="module-progress-block">
        <h1 className="course-title">{moduleTitle}</h1>
        <div className="progress-meter">
          <div className="progress-bar">
            <div
              className="progress-bar-fill"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <p className="progress-percentage">
            {Math.round(progressPercentage)}% complete
          </p>
        </div>
      </div>
      
      {/* Section Title With Decimal */}
      <h2 className="section-title">
        {section.displayNumber} {section.title}
      </h2>
      <div className="section-content">
        {Array.isArray(section.content)
          ? section.content.map((block, idx) =>
              renderContentBlock(block, idx, sources, section.id, handleQuizSubmissionChange)
            )
          : <p>{section.content}</p> /* fallback for old data */}
      </div>

      {sectionSources.length > 0 && (
        <section className="source-reference-list" aria-label="Sources">
          <h3>Sources</h3>
          <ul>
            {sectionSources.map((source) => (
              <li key={source.id}>
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
        </section>
      )}

      <div className="section-nav">
        <div className="nav-button-wrapper">
          <button
            className="nav-button"
            onClick={onPrev}
            disabled={isFirstSection}
          >
            Previous
          </button>
        </div>
        <div className="nav-button-wrapper">
          <button
            className={`nav-button complete-button ${isComplete ? "complete-button--checked" : ""} ${
              !isComplete && !allRequiredQuizzesSubmitted ? "complete-button--blocked" : ""
            }`}
            onClick={() => {
              if (canMarkComplete) {
                markComplete(section.id);
              }
            }}
            aria-disabled={isComplete || !allRequiredQuizzesSubmitted}
            aria-label={isComplete ? "Section complete" : "Mark section complete"}
            title={completeButtonTitle}
          >
            <span className="complete-button-check" aria-hidden="true">✓</span>
          </button>
          <button
            className="nav-button"
            onClick={onNext}
            disabled={isLastSection || (Boolean(orderMandatory) && !isComplete)}
          >
            Next
          </button>
        </div>
      </div>
    </main>
  );
  
}

// AI generated function to render content blocks
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
  onQuizSubmissionChange: QuizSubmissionStatusHandler
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

    case "video":
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
        <div key={key} className="video-wrapper">
          <iframe
            width="560"
            height="315"
            src={videoUrl}
            title={videoSource?.title ?? "Video content"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          ></iframe>
        </div>
      );
      
    case "quiz":
    const quizKey = `quiz-${sectionId}-${key}`;
    return (
      <QuizBlock
        key={key}
        data={item}
        name={quizKey}
        onSubmissionChange={onQuizSubmissionChange}
      />
    );
      
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

import type { ReactNode } from "react";
import QuizBlock from "../Quiz/QuizBlock";
import VideoBlock from "../Video/VideoBlock";
import { EditPencilButton, promptForText } from "./CourseEditControls";
import type {
  ConceptCard,
  ContentBlock,
  QuizProgressStatusHandler,
  QuizSubmissionStatusHandler,
  SourceRecord,
} from "./contentViewTypes";

type EditableContentBlockProps = {
  block: ContentBlock;
  blockIndex: number;
  sources: SourceRecord[];
  sectionId: string;
  isEditMode: boolean;
  onBlockChange?: (sectionId: string, blockIndex: number, block: ContentBlock) => void;
  onQuizSubmissionChange: QuizSubmissionStatusHandler;
  onQuizProgressChange: QuizProgressStatusHandler;
};

function getSourcesByIds(sourceIds: string[] | undefined, sources: SourceRecord[]) {
  if (!Array.isArray(sourceIds) || sourceIds.length === 0) {
    return [];
  }

  const sourceMap = new Map(sources.map((source) => [source.id, source]));
  return sourceIds
    .map((sourceId) => sourceMap.get(sourceId))
    .filter((source): source is SourceRecord => Boolean(source));
}

function getVideoClip(item: ContentBlock) {
  const clip = item.clip ?? {};
  const startSeconds = clip.startSeconds ?? clip.start ?? item.startSeconds ?? item.start_seconds;
  const endSeconds = clip.endSeconds ?? clip.end ?? item.endSeconds ?? item.end_seconds;

  if (startSeconds === undefined && endSeconds === undefined) {
    return undefined;
  }

  return { startSeconds, endSeconds };
}

function withUpdatedCard(cards: Array<ConceptCard | string>, cardIndex: number, card: ConceptCard | string) {
  return cards.map((currentCard, index) => (index === cardIndex ? card : currentCard));
}

function asConceptCard(card: ConceptCard | string): ConceptCard {
  return typeof card === "string" ? { name: card } : card;
}

export default function EditableContentBlock({
  block,
  blockIndex,
  sources,
  sectionId,
  isEditMode,
  onBlockChange,
  onQuizSubmissionChange,
  onQuizProgressChange,
}: EditableContentBlockProps) {
  const blockSources = getSourcesByIds(block.sourceIds, sources);
  const updateBlock = (nextBlock: ContentBlock) => onBlockChange?.(sectionId, blockIndex, nextBlock);
  const editShell = (children: ReactNode, actions?: ReactNode) => (
    <div className={`editable-block-shell ${isEditMode ? "editable-block-shell--active" : ""}`}>
      {isEditMode && actions && <div className="content-block-edit-actions">{actions}</div>}
      {children}
    </div>
  );

  switch (block.type) {
    case "text": {
      const bodyField = block.value !== undefined ? "value" : "text";
      const bodyValue = block.value ?? block.text;
      return editShell(
        <div className="text-block">
          {block.heading && (
            <h3 className="course-editable-line">
              <span className="course-editable-line-content">{block.heading}</span>
              {isEditMode && (
                <EditPencilButton
                  label="Edit text heading"
                  onClick={() => promptForText("Edit text heading", block.heading, (heading) => updateBlock({ ...block, heading }))}
                />
              )}
            </h3>
          )}
          {bodyValue && (
            <p className="course-editable-line">
              <span className="course-editable-line-content">{bodyValue}</span>
              {isEditMode && (
                <EditPencilButton
                  label="Edit text block"
                  onClick={() => promptForText("Edit text block", bodyValue, (value) => updateBlock({ ...block, [bodyField]: value }))}
                />
              )}
            </p>
          )}
        </div>,
      );
    }

    case "conceptCards":
    case "concept_cards":
      return renderConceptCards(block, isEditMode, updateBlock);

    case "video": {
      const videoSource = blockSources.find((source) => source.embedUrl) ?? blockSources[0];
      const videoUrl = block.url ?? videoSource?.embedUrl ?? videoSource?.url;
      const clip = getVideoClip(block);
      const video = videoUrl ? (
        <VideoBlock url={videoUrl} title={videoSource?.title ?? block.title ?? "Video content"} clip={clip} />
      ) : (
        <p className="source-missing">Video source unavailable.</p>
      );

      return editShell(
        video,
        <>
          <EditPencilButton
            label="Edit video title"
            onClick={() => promptForText("Edit video title", block.title, (title) => updateBlock({ ...block, title }))}
          />
          <EditPencilButton
            label="Edit video URL"
            onClick={() => promptForText("Edit video URL", videoUrl, (url) => updateBlock({ ...block, url }))}
          />
        </>,
      );
    }

    case "quiz": {
      const quizKey = `quiz-${sectionId}-${blockIndex}`;
      return editShell(
        <QuizBlock
          data={block}
          name={quizKey}
          onSubmissionChange={onQuizSubmissionChange}
          onProgressChange={onQuizProgressChange}
        />,
        <EditPencilButton
          label="Edit quiz title"
          onClick={() => promptForText("Edit quiz title", block.title, (title) => updateBlock({ ...block, title }))}
        />,
      );
    }

    case "game":
      return editShell(
        <div className="game-block">
          <p><strong>Game:</strong> {block.name || "Unnamed game"}</p>
          {block.description && <p>{block.description}</p>}
        </div>,
        <>
          <EditPencilButton
            label="Edit activity name"
            onClick={() => promptForText("Edit activity name", block.name, (name) => updateBlock({ ...block, name }))}
          />
          <EditPencilButton
            label="Edit activity description"
            onClick={() => promptForText("Edit activity description", block.description, (description) => updateBlock({ ...block, description }))}
          />
        </>,
      );

    default:
      return <p>Unknown content type</p>;
  }
}

function renderConceptCards(item: ContentBlock, isEditMode: boolean, onBlockChange: (block: ContentBlock) => void) {
  const cards = item.concepts ?? item.cards ?? [];
  const cardField = item.concepts ? "concepts" : "cards";

  if (cards.length === 0) {
    return null;
  }

  const updateCard = (cardIndex: number, nextCard: ConceptCard | string) => {
    onBlockChange({ ...item, [cardField]: withUpdatedCard(cards, cardIndex, nextCard) });
  };

  return (
    <section className={`concept-card-stack ${isEditMode ? "editable-block-shell--active" : ""}`} aria-label={item.title ?? "Concept cards"}>
      {isEditMode && (
        <div className="content-block-edit-actions">
          <EditPencilButton
            label="Edit concept card stack title"
            onClick={() => promptForText("Edit concept card stack title", item.title, (title) => onBlockChange({ ...item, title }))}
          />
        </div>
      )}
      {item.title && <h3 className="concept-card-stack-title">{item.title}</h3>}
      {cards.map((card, idx) => {
        const concept = asConceptCard(card);
        const title = concept.name ?? concept.title ?? concept.heading ?? `Concept ${idx + 1}`;
        const body = concept.description ?? concept.body ?? concept.value ?? concept.text;

        return (
          <article className="concept-card" key={`${title}-${idx}`}>
            <div className="course-editable-line">
              <h4>{title}</h4>
              {isEditMode && (
                <EditPencilButton
                  label="Edit concept title"
                  onClick={() => promptForText("Edit concept title", title, (name) => updateCard(idx, { ...concept, name }))}
                />
              )}
            </div>
            <div className="course-editable-line">
              {body && <p>{body}</p>}
              {isEditMode && (
                <EditPencilButton
                  label="Edit concept description"
                  onClick={() => promptForText("Edit concept description", body, (description) => updateCard(idx, { ...concept, description }))}
                />
              )}
            </div>
          </article>
        );
      })}
    </section>
  );
}

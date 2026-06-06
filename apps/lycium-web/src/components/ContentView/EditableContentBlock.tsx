import type { ReactNode } from "react";
import QuizBlock from "../Quiz/QuizBlock";
import VideoBlock from "../Video/VideoBlock";
import { DeleteBlockButton, EditPencilButton, promptForDeleteBlock, promptForText } from "./CourseEditControls";
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
  onBlockDelete?: (sectionId: string, blockIndex: number) => void;
  onCitationClick?: (citationIndex: number) => void;
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
  onBlockDelete,
  onCitationClick,
  onQuizSubmissionChange,
  onQuizProgressChange,
}: EditableContentBlockProps) {
  const blockSources = getSourcesByIds(block.sourceIds, sources);
  const updateBlock = (nextBlock: ContentBlock) => onBlockChange?.(sectionId, blockIndex, nextBlock);
  const deleteAction = (
    <DeleteBlockButton
      label="Delete block"
      onClick={() => promptForDeleteBlock(() => onBlockDelete?.(sectionId, blockIndex))}
    />
  );
  const editShell = (children: ReactNode, actions?: ReactNode) => (
    <div className={`editable-block-shell ${isEditMode ? "editable-block-shell--active" : ""}`}>
      {isEditMode && <div className="content-block-delete-row">{deleteAction}</div>}
      {isEditMode && (
        <div className="content-block-edit-actions">
          {actions}
        </div>
      )}
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
              <span className="course-editable-line-content">{renderCitationText(block.heading, onCitationClick)}</span>
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
              <span className="course-editable-line-content">{renderCitationText(bodyValue, onCitationClick)}</span>
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
      return renderConceptCards(
        block,
        isEditMode,
        updateBlock,
        () => promptForDeleteBlock(() => onBlockDelete?.(sectionId, blockIndex)),
      );

    case "conceptCard":
    case "concept_card": {
      const title = block.title ?? block.heading ?? block.name ?? "Concept title";
      const body = block.description ?? block.body ?? block.value ?? block.text;

      return editShell(
        <article className="concept-card concept-card--single">
          <div className="course-editable-line">
            <h4>{title}</h4>
            {isEditMode && (
              <EditPencilButton
                label="Edit concept title"
                onClick={() => promptForText("Edit concept title", title, (nextTitle) => updateBlock({ ...block, title: nextTitle }))}
              />
            )}
          </div>
          <div className="course-editable-line">
            {body && <p>{body}</p>}
            {isEditMode && (
              <EditPencilButton
                label="Edit concept description"
                onClick={() => promptForText("Edit concept description", body, (description) => updateBlock({ ...block, description }))}
              />
            )}
          </div>
        </article>,
      );
    }

    case "heading": {
      const heading = block.title ?? block.heading ?? block.value ?? block.text ?? "Heading title";
      return editShell(
        <h3 className="course-editable-line content-heading-block">
          <span className="course-editable-line-content">{renderCitationText(heading, onCitationClick)}</span>
          {isEditMode && (
            <EditPencilButton
              label="Edit heading"
              onClick={() => promptForText("Edit heading", heading, (title) => updateBlock({ ...block, title }))}
            />
          )}
        </h3>,
      );
    }

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
        <EditPencilButton
          label="Edit video URL"
          onClick={() => promptForText("Edit video URL", videoUrl, (url) => updateBlock({ ...block, url }))}
        />,
      );
    }

    case "iframe": {
      const frameSource = blockSources[0];
      const frameUrl = block.url ?? frameSource?.embedUrl ?? frameSource?.url;
      const frameTitle = block.title ?? frameSource?.title ?? "Embedded resource";

      return editShell(
        <div className="iframe-block">
          {frameUrl ? (
            <iframe title={frameTitle} src={frameUrl} loading="lazy" />
          ) : (
            <p className="source-missing">Iframe source unavailable.</p>
          )}
        </div>,
        <>
          <EditPencilButton
            label="Edit iframe title"
            onClick={() => promptForText("Edit iframe title", frameTitle, (title) => updateBlock({ ...block, title }))}
          />
          <EditPencilButton
            label="Edit iframe URL"
            onClick={() => promptForText("Edit iframe URL", frameUrl, (url) => updateBlock({ ...block, url }))}
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
          isEditMode={isEditMode}
          onDataChange={(nextData) => updateBlock({ ...block, ...nextData })}
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

function renderCitationText(value: string | undefined, onCitationClick?: (citationIndex: number) => void): ReactNode {
  if (!value || !onCitationClick) {
    return value;
  }

  const parts: ReactNode[] = [];
  const citationPattern = /\[(\d+)\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = citationPattern.exec(value)) !== null) {
    if (match.index > lastIndex) {
      parts.push(value.slice(lastIndex, match.index));
    }

    const citationIndex = Number(match[1]);
    parts.push(
      <sup className="inline-citation" key={`${match.index}-${match[0]}`}>
        <button
          type="button"
          aria-label={`Open source ${citationIndex}`}
          onClick={() => onCitationClick(citationIndex)}
        >
          [{citationIndex}]
        </button>
      </sup>,
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < value.length) {
    parts.push(value.slice(lastIndex));
  }

  return parts.length > 0 ? parts : value;
}

function renderConceptCards(item: ContentBlock, isEditMode: boolean, onBlockChange: (block: ContentBlock) => void, onBlockDelete: () => void) {
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
        <div className="content-block-delete-row">
          <DeleteBlockButton
            label="Delete block"
            onClick={onBlockDelete}
          />
        </div>
      )}
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

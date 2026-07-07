import type { ReactNode } from "react";
import { DeleteBlockButton, EditPencilButton, promptForText } from "./CourseEditControls";
import type { ConceptCard, ContentBlock } from "./contentViewTypes";

type ConceptCardStackProps = {
  block: ContentBlock;
  citation: ReactNode;
  isEditMode: boolean;
  onBlockChange: (block: ContentBlock) => void;
  onBlockDelete: () => void;
};

export function replaceConceptCard(
  cards: Array<ConceptCard | string>,
  cardIndex: number,
  card: ConceptCard | string,
) {
  return cards.map((currentCard, index) => (index === cardIndex ? card : currentCard));
}

export function conceptCardFrom(card: ConceptCard | string): ConceptCard {
  return typeof card === "string" ? { name: card } : card;
}

export default function ConceptCardStack({
  block,
  citation,
  isEditMode,
  onBlockChange,
  onBlockDelete,
}: ConceptCardStackProps) {
  const cards = block.concepts ?? block.cards ?? [];
  const cardField = block.concepts ? "concepts" : "cards";

  if (cards.length === 0) {
    return null;
  }

  const updateCard = (cardIndex: number, nextCard: ConceptCard | string) => {
    onBlockChange({ ...block, [cardField]: replaceConceptCard(cards, cardIndex, nextCard) });
  };

  return (
    <section
      className={`concept-card-stack ${isEditMode ? "editable-block-shell--active" : ""}`}
      aria-label={block.title ?? "Concept cards"}
    >
      {isEditMode && (
        <div className="content-block-delete-row">
          <DeleteBlockButton label="Delete block" onClick={onBlockDelete} />
        </div>
      )}
      {isEditMode && (
        <div className="content-block-edit-actions">
          <EditPencilButton
            label="Edit concept card stack title"
            onClick={() =>
              promptForText("Edit concept card stack title", block.title, (title) => onBlockChange({ ...block, title }))
            }
          />
        </div>
      )}
      {block.title && <h3 className="concept-card-stack-title">{block.title}</h3>}
      {cards.map((card, index) => {
        const concept = conceptCardFrom(card);
        const title = concept.name ?? concept.title ?? concept.heading ?? `Concept ${index + 1}`;
        const body = concept.description ?? concept.body ?? concept.value ?? concept.text;

        return (
          <article className="concept-card" key={`${title}-${index}`}>
            <div className="course-editable-line">
              <h4>{title}</h4>
              {isEditMode && (
                <EditPencilButton
                  label="Edit concept title"
                  onClick={() =>
                    promptForText("Edit concept title", title, (name) => updateCard(index, { ...concept, name }))
                  }
                />
              )}
            </div>
            <div className="course-editable-line">
              {body && <p>{body}</p>}
              {isEditMode && (
                <EditPencilButton
                  label="Edit concept description"
                  onClick={() =>
                    promptForText("Edit concept description", body, (description) =>
                      updateCard(index, { ...concept, description }),
                    )
                  }
                />
              )}
            </div>
          </article>
        );
      })}
      {citation}
    </section>
  );
}

import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, Copy, Ellipsis, Pencil, Search, Star, Trash2 } from "lucide-react";
import { MAX_CARDS, moveCard, type Flashcard, type FlashcardDeck, type FlashcardReview } from "./flashcardDomain";
import { cardsFromText, type CardText } from "./flashcardImport";
import FlashcardComposer from "./FlashcardComposer";

type Props = {
  deck: FlashcardDeck;
  reviews: Record<string, FlashcardReview>;
  onUpdate: (deck: FlashcardDeck) => void;
  onImport: () => void;
  onStar: (cardId: string) => void;
  scheduledCardIds: ReadonlySet<string>;
  onResetSchedule: (cardId: string) => void;
  announce: (message: string) => void;
};

export default function FlashcardEditor({ deck, reviews, onUpdate, onImport, onStar, scheduledCardIds, onResetSchedule, announce }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [query, setQuery] = useState(""), [starredOnly, setStarredOnly] = useState(false), [limit, setLimit] = useState(50);
  const editButtons = useRef(new Map<string, HTMLButtonElement>());
  const search = useRef<HTMLInputElement>(null);
  // Keep an unsaved editor visible even if a filter no longer matches that row.
  const filtered = deck.cards.map((card, index) => ({ card, index })).filter(({ card }) => card.id === editing || ((!starredOnly || reviews[card.id]?.starred) && (card.front + " " + card.back).toLocaleLowerCase().includes(query.toLocaleLowerCase())));

  function finishEditing(id: string) {
    setEditing(null);
    window.requestAnimationFrame(() => (editButtons.current.get(id) ?? search.current)?.focus({ preventScroll: true }));
  }
  function addCard(text: CardText) {
    onUpdate({ ...deck, cards: [...deck.cards, ...cardsFromText([text])], updatedAt: new Date().toISOString() });
    announce("Card added. Ready for the next one.");
  }
  function saveCard(id: string, text: CardText) {
    const now = new Date().toISOString();
    const previous = deck.cards.find((card) => card.id === id);
    const contentChanged = previous && (previous.front.trim() !== text.front.trim() || previous.back.trim() !== text.back.trim());
    const reset = contentChanged && scheduledCardIds.has(id) && !window.confirm("This card has spaced-review history. Click OK to keep its schedule, or Cancel to reset it and start the edited card fresh.");
    onUpdate({ ...deck, cards: deck.cards.map((card) => card.id === id ? { ...card, ...text, updatedAt: now } : card), updatedAt: now });
    if (reset) onResetSchedule(id);
    finishEditing(id);
    announce(reset ? "Card updated and review schedule reset." : "Card updated.");
  }
  function remove(card: Flashcard) {
    if (!window.confirm("Delete this card? Export your deck first if you want a backup.")) return;
    onUpdate({ ...deck, cards: deck.cards.filter((item) => item.id !== card.id), updatedAt: new Date().toISOString() });
    if (editing === card.id) setEditing(null);
    announce("Card deleted.");
  }

  return <section className="fc-editor" aria-label="Edit cards">
    <FlashcardComposer onSave={addCard} onImport={onImport} disabled={deck.cards.length >= MAX_CARDS} />
    {deck.cards.length >= MAX_CARDS && <p className="fc-warning">This deck has reached its 5,000-card limit.</p>}
    <div className="fc-card-list-heading">
      <h2>{deck.cards.length} {deck.cards.length === 1 ? "card" : "cards"} in this deck</h2>
      <div className="fc-list-filters"><label className="fc-search"><Search size={16} /><input ref={search} type="search" aria-label="Search cards" placeholder="Search cards" value={query} onChange={(event) => { setQuery(event.target.value); setLimit(50); }} /></label><button className="fc-icon fc-star" aria-label="Show starred cards" aria-pressed={starredOnly} title="Show starred cards" onClick={() => { setStarredOnly(!starredOnly); setLimit(50); }}><Star size={18} fill={starredOnly ? "currentColor" : "none"} /></button></div>
    </div>
    <div className="fc-card-list">{filtered.slice(0, limit).map(({ card, index }) => <article className={"fc-card-row" + (editing === card.id ? " is-editing" : "")} key={card.id}>
      <span className="fc-card-number">{index + 1}</span>
      {editing === card.id ? <FlashcardComposer initial={card} number={index + 1} onSave={(text) => saveCard(card.id, text)} onCancel={() => finishEditing(card.id)} /> : <>
        <div className="fc-card-row-text"><div><span>Front</span><p>{card.front}</p></div><div><span>Back</span><p>{card.back}</p></div></div>
        <div className="fc-row-actions">
          <button className="fc-icon fc-star" aria-label={(reviews[card.id]?.starred ? "Unstar" : "Star") + " card " + (index + 1)} aria-pressed={!!reviews[card.id]?.starred} title={reviews[card.id]?.starred ? "Unstar card" : "Star card"} onClick={() => onStar(card.id)}><Star size={17} fill={reviews[card.id]?.starred ? "currentColor" : "none"} /></button>
          <button className="fc-icon" ref={(node) => { if (node) editButtons.current.set(card.id, node); else editButtons.current.delete(card.id); }} aria-label={"Edit card " + (index + 1)} title="Edit card" onClick={() => setEditing(card.id)}><Pencil size={16} /></button>
          <details className="fc-row-menu"><summary aria-label={"More actions for card " + (index + 1)} title="More card actions"><Ellipsis size={18} /></summary><div className="fc-popover">
            <button disabled={index === 0} onClick={() => onUpdate(moveCard(deck, card.id, -1))}><ArrowUp size={15} /> Move up</button>
            <button disabled={index === deck.cards.length - 1} onClick={() => onUpdate(moveCard(deck, card.id, 1))}><ArrowDown size={15} /> Move down</button>
            <button disabled={deck.cards.length >= MAX_CARDS} onClick={() => { const cards = [...deck.cards]; cards.splice(index + 1, 0, ...cardsFromText([card])); onUpdate({ ...deck, cards, updatedAt: new Date().toISOString() }); announce("Card duplicated."); }}><Copy size={15} /> Duplicate</button>
            <button className="fc-danger-text" onClick={() => remove(card)}><Trash2 size={15} /> Delete card</button>
          </div></details>
        </div>
      </>}
    </article>)}</div>
    {!filtered.length && <div className="fc-empty fc-empty-small"><p>{deck.cards.length ? "No cards match your search." : "Add cards above or import your notes to build this deck."}</p></div>}
    {filtered.length > limit && <button className="fc-button fc-load-more" onClick={() => setLimit(limit + 50)}>Show more ({filtered.length - limit} remaining)</button>}
  </section>;
}

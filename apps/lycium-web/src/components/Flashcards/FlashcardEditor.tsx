import { useRef, useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp, Check, Copy, Ellipsis, Pencil, Plus, Search, Star, Trash2, Upload } from "lucide-react";
import { MAX_CARDS, MAX_SIDE_LENGTH, moveCard, type Flashcard, type FlashcardDeck, type FlashcardReview } from "./flashcardDomain";
import { cardsFromText } from "./flashcardImport";

type Props = { deck: FlashcardDeck; reviews: Record<string, FlashcardReview>; onUpdate: (deck: FlashcardDeck) => void; onImport: () => void; onStar: (cardId: string) => void; announce: (message: string) => void };

export default function FlashcardEditor({ deck, reviews, onUpdate, onImport, onStar, announce }: Props) {
  const [draft, setDraft] = useState({ front: "", back: "" }), [editing, setEditing] = useState<string | null>(null);
  const [query, setQuery] = useState(""), [starredOnly, setStarredOnly] = useState(false), [limit, setLimit] = useState(50);
  const front = useRef<HTMLTextAreaElement>(null), form = useRef<HTMLFormElement>(null);
  const filtered = deck.cards.map((card, index) => ({ card, index })).filter(({ card }) => (!starredOnly || reviews[card.id]?.starred) && (card.front + " " + card.back).toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  function save(event: FormEvent) {
    event.preventDefault();
    if (!draft.front.trim() || !draft.back.trim() || (!editing && deck.cards.length >= MAX_CARDS)) return;
    const now = new Date().toISOString();
    const cards = editing ? deck.cards.map((card) => card.id === editing ? { ...card, ...draft, front: draft.front.trim(), back: draft.back.trim(), updatedAt: now } : card) : [...deck.cards, ...cardsFromText([draft])];
    onUpdate({ ...deck, cards, updatedAt: now });
    announce(editing ? "Card updated." : "Card added. Ready for the next one.");
    setDraft({ front: "", back: "" }); setEditing(null); front.current?.focus();
  }
  function edit(card: Flashcard) {
    setEditing(card.id); setDraft({ front: card.front, back: card.back });
    form.current?.scrollIntoView({ block: "nearest" }); front.current?.focus();
  }
  function remove(card: Flashcard) {
    if (!window.confirm("Delete this card? Export your deck first if you want a backup.")) return;
    onUpdate({ ...deck, cards: deck.cards.filter((item) => item.id !== card.id), updatedAt: new Date().toISOString() });
    if (editing === card.id) { setEditing(null); setDraft({ front: "", back: "" }); }
    announce("Card deleted.");
  }
  return <section className="fc-editor" aria-label="Edit cards">
    <form className={"fc-card-editor" + (editing ? " is-editing" : "")} onSubmit={save} ref={form} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); event.currentTarget.requestSubmit(); } }}>
      <div className="fc-section-heading"><h2>{editing ? "Edit card" : "Add a card"}</h2><button className="fc-text-button" type="button" onClick={onImport}><Upload size={15} /> Import in bulk</button></div>
      <div className="fc-editor-grid"><label>Front <span>Question or term</span><textarea ref={front} value={draft.front} maxLength={MAX_SIDE_LENGTH} onChange={(event) => setDraft({ ...draft, front: event.target.value })} placeholder="What do you want to remember?" required /></label><label>Back <span>Answer or explanation</span><textarea value={draft.back} maxLength={MAX_SIDE_LENGTH} onChange={(event) => setDraft({ ...draft, back: event.target.value })} placeholder="Add the answer here" required /></label></div>
      <div className="fc-editor-footer"><span className="fc-muted">⌘ / Ctrl + Enter to save</span><div className="fc-inline-actions">{editing && <button type="button" className="fc-button" onClick={() => { setEditing(null); setDraft({ front: "", back: "" }); front.current?.focus(); }}>Cancel edit</button>}<button className="fc-button fc-primary" disabled={!draft.front.trim() || !draft.back.trim() || (!editing && deck.cards.length >= MAX_CARDS)}>{editing ? <Check size={16} /> : <Plus size={16} />}{editing ? "Save changes" : "Add card"}</button></div></div>
      {deck.cards.length >= MAX_CARDS && <p className="fc-warning">This deck has reached its 5,000-card limit.</p>}
    </form>
    <div className="fc-card-list-heading"><h2>{deck.cards.length} {deck.cards.length === 1 ? "card" : "cards"} in this deck</h2><div className="fc-list-filters"><label className="fc-search"><Search size={16} /><input type="search" aria-label="Search cards" placeholder="Search cards" value={query} onChange={(event) => { setQuery(event.target.value); setLimit(50); }} /></label><button className="fc-icon fc-star" aria-label="Show starred cards" aria-pressed={starredOnly} onClick={() => { setStarredOnly(!starredOnly); setLimit(50); }}><Star size={18} fill={starredOnly ? "currentColor" : "none"} /></button></div></div>
    <div className="fc-card-list">{filtered.slice(0, limit).map(({ card, index }) => <article className="fc-card-row" key={card.id}>
      <span className="fc-card-number">{index + 1}</span><div className="fc-card-row-text"><div><span>Front</span><p>{card.front}</p></div><div><span>Back</span><p>{card.back}</p></div></div>
      <div className="fc-row-actions"><button className="fc-icon fc-star" aria-label={(reviews[card.id]?.starred ? "Unstar" : "Star") + " card " + (index + 1)} aria-pressed={!!reviews[card.id]?.starred} onClick={() => onStar(card.id)}><Star size={17} fill={reviews[card.id]?.starred ? "currentColor" : "none"} /></button><button className="fc-icon" aria-label={"Edit card " + (index + 1)} onClick={() => edit(card)}><Pencil size={16} /></button><details className="fc-row-menu"><summary aria-label={"More actions for card " + (index + 1)}><Ellipsis size={18} /></summary><div className="fc-popover"><button disabled={index === 0} onClick={() => onUpdate(moveCard(deck, card.id, -1))}><ArrowUp size={15} /> Move up</button><button disabled={index === deck.cards.length - 1} onClick={() => onUpdate(moveCard(deck, card.id, 1))}><ArrowDown size={15} /> Move down</button><button disabled={deck.cards.length >= MAX_CARDS} onClick={() => { const cards = [...deck.cards]; cards.splice(index + 1, 0, ...cardsFromText([card])); onUpdate({ ...deck, cards, updatedAt: new Date().toISOString() }); announce("Card duplicated."); }}><Copy size={15} /> Duplicate</button><button className="fc-danger-text" onClick={() => remove(card)}><Trash2 size={15} /> Delete card</button></div></details></div>
    </article>)}</div>
    {!filtered.length && <div className="fc-empty fc-empty-small"><p>{deck.cards.length ? "No cards match your search." : "Add cards above or import your notes to build this deck."}</p></div>}
    {filtered.length > limit && <button className="fc-button fc-load-more" onClick={() => setLimit(limit + 50)}>Show more ({filtered.length - limit} remaining)</button>}
  </section>;
}

import { useRef, useState } from "react";
import { ChevronDown, Plus, Search } from "lucide-react";
import { DECK_COLORS, type FlashcardDeck } from "./flashcardDomain";

type Props = { decks: FlashcardDeck[]; selectedId: string; onSelect: (id: string) => void; onCreate: () => void };

export default function FlashcardDeckPicker({ decks, selectedId, onSelect, onCreate }: Props) {
  const picker = useRef<HTMLDetailsElement>(null);
  const [query, setQuery] = useState("");
  const selected = decks.find((deck) => deck.id === selectedId);
  function close() { if (picker.current) picker.current.open = false; }
  const matches = decks.filter((deck) => deck.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  return <details className="fc-mobile-deck-picker" ref={picker}>
    <summary aria-label="Choose deck"><strong>{selected?.title || "Untitled deck"}</strong><ChevronDown size={18} /></summary>
    <div className="fc-popover">
      <h3>My decks</h3>
      {decks.length > 3 && <label className="fc-search"><Search size={15} /><input type="search" aria-label="Find a deck on mobile" placeholder="Find a deck" value={query} onChange={(event) => setQuery(event.target.value)} /></label>}
      <div className="fc-deck-list">{matches.map((deck) => <button key={deck.id} className={"fc-deck-item" + (deck.id === selectedId ? " is-selected" : "")} aria-current={deck.id === selectedId ? "true" : undefined} onClick={() => { close(); onSelect(deck.id); }}><span className="fc-deck-marker" style={{ backgroundColor: deck.color ?? DECK_COLORS[0].value }} /><span><strong>{deck.title || "Untitled deck"}</strong><small>{deck.cards.length} {deck.cards.length === 1 ? "card" : "cards"}</small></span></button>)}</div>
      {!matches.length && <p>No decks match your search.</p>}
      <button onClick={() => { close(); onCreate(); }}><Plus size={16} /> Create a deck</button>
    </div>
  </details>;
}

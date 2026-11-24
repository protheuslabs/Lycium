"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Edit3, Eye, Plus, RotateCcw, Shuffle, Trash2 } from "lucide-react";
import Link from "next/link";
import { createId, createStudySession, recordReview, starterDeck, type Flashcard, type FlashcardDeck, type FlashcardStore, type StudySession } from "./flashcardDomain";
import { loadFlashcardStore, saveFlashcardStore } from "./flashcardStorage";
import "./flashcards.css";

type Mode = "study" | "cards";

export default function FlashcardsApp() {
  const [store, setStore] = useState<FlashcardStore>({ version: 1, decks: [], history: {} });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("study");
  const [flipped, setFlipped] = useState(false);
  const [session, setSession] = useState<StudySession | null>(null);
  const [, setIndex] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [reviewOnly, setReviewOnly] = useState(false);
  const [shuffled, setShuffled] = useState(false);
  const [draft, setDraft] = useState({ front: "", back: "" });
  const [editingCardId, setEditingCardId] = useState<string | null>(null);

  const deck = store.decks.find((item) => item.id === selectedId) ?? null;
  const cards = useMemo(() => session && deck ? session.cardIds.map((id) => deck.cards.find((item) => item.id === id)).filter((item): item is Flashcard => Boolean(item)) : [], [deck, session]);
  const index = session?.position ?? 0;
  const card = cards[index] ?? null;
  const reviewed = deck ? deck.cards.filter((item) => store.history[deck.id]?.[item.id]).length : 0;
  const missed = deck ? deck.cards.filter((item) => store.history[deck.id]?.[item.id]?.status === "review").length : 0;

  useEffect(() => { const loaded = loadFlashcardStore(); setStore(loaded); setSelectedId(loaded.decks[0]?.id ?? null); setHydrated(true); }, []);
  useEffect(() => { if (hydrated) saveFlashcardStore(store); }, [hydrated, store]);
  useEffect(() => { if (deck) { setSession(createStudySession(deck, store.history, reviewOnly, shuffled)); setFlipped(false); } else setSession(null); }, [selectedId, reviewOnly, shuffled]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && (target.closest("input, textarea, select, button, a, [role=dialog]") || target.isContentEditable)) return;
      if ((event.key === " " || event.key === "Enter") && card) { event.preventDefault(); setFlipped((value) => !value); }
      if (event.key === "ArrowLeft") navigate(-1);
      if (event.key === "ArrowRight") navigate(1);
      if (event.key === "1" && card && flipped) mark("review");
      if (event.key === "2" && card && flipped) mark("known");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  function navigate(delta: number) { setFlipped(false); setSession((value) => value ? { ...value, position: Math.max(0, Math.min(value.cardIds.length, value.position + delta)) } : value); }
  function mark(status: "known" | "review") {
    if (!deck || !card) return;
    setStore((value) => recordReview(value, deck.id, card.id, status));
    setFlipped(false); setSession((value) => value ? { ...value, position: Math.min(value.cardIds.length, value.position + 1) } : value);
  }
  function createDeck() {
    const now = new Date().toISOString();
    const next: FlashcardDeck = { id: createId("deck"), title: "New deck", description: "", cards: [], createdAt: now, updatedAt: now };
    setStore((value) => ({ ...value, decks: [...value.decks, next] })); setSelectedId(next.id); setMode("cards");
  }
  function addCard() {
    if (!deck || !draft.front.trim() || !draft.back.trim()) return;
    const now = new Date().toISOString(); const nextCard: Flashcard = { id: createId("card"), front: draft.front.trim(), back: draft.back.trim(), createdAt: now, updatedAt: now };
    updateDeck({ ...deck, cards: [...deck.cards, nextCard], updatedAt: now }); setDraft({ front: "", back: "" });
  }
  function saveCardEdit() {
    if (!deck || !editingCardId || !draft.front.trim() || !draft.back.trim()) return;
    const now = new Date().toISOString();
    updateDeck({ ...deck, cards: deck.cards.map((item) => item.id === editingCardId ? { ...item, front: draft.front.trim(), back: draft.back.trim(), updatedAt: now } : item), updatedAt: now });
    setEditingCardId(null); setDraft({ front: "", back: "" });
  }
  function updateDeck(next: FlashcardDeck) { setStore((value) => ({ ...value, decks: value.decks.map((item) => item.id === next.id ? next : item) })); }
  function deleteDeck() { if (!deck || !window.confirm(`Delete “${deck.title}”?`)) return; const remaining = store.decks.filter((item) => item.id !== deck.id); setStore((value) => ({ ...value, decks: remaining, history: Object.fromEntries(Object.entries(value.history).filter(([id]) => id !== deck.id)) })); setSelectedId(remaining[0]?.id ?? null); }
  function addStarter() { setStore((value) => ({ ...value, decks: [starterDeck, ...value.decks] })); setSelectedId(starterDeck.id); }

  return <div className="flashcards-app">
    <header className="flashcards-header"><Link href="/tools" className="flashcards-back"><ArrowLeft size={16} /> Back to Tools</Link><h1>Flashcards</h1><p className="flashcards-workspace-description">Create decks, review cards, and build durable recall.</p><button className="flashcards-primary" onClick={createDeck}><Plus size={17} /> New deck</button></header>
    <div className="flashcards-layout">
      <aside className="flashcards-sidebar" aria-label="Flashcard decks"><div className="flashcards-sidebar-heading"><span>My decks</span><button className="icon-button" onClick={createDeck} aria-label="Create deck"><Plus size={17} /></button></div>
        {store.decks.length === 0 ? <div className="flashcards-empty-sidebar"><p>No decks yet.</p><button onClick={addStarter}>Try a starter deck</button></div> : <div className="flashcards-deck-list">{store.decks.map((item) => <button key={item.id} className={`flashcards-deck-item ${item.id === selectedId ? "is-selected" : ""}`} onClick={() => { setSelectedId(item.id); setMode("study"); }}><strong>{item.title}</strong><span>{item.cards.length} {item.cards.length === 1 ? "card" : "cards"}</span></button>)}</div>}
      </aside>
      <main className="flashcards-main">{!deck ? <section className="flashcards-welcome"><div className="flashcards-welcome-icon"><Eye size={24} /></div><h2>Build your study stack</h2><p>Create a deck for a course, a lab, or anything you want to remember.</p><button className="flashcards-primary" onClick={createDeck}><Plus size={17} /> Create your first deck</button><button className="flashcards-secondary" onClick={addStarter}>Start with chemistry examples</button></section> : <>
        <div className="flashcards-deck-header"><div><input className="flashcards-title-input" value={deck.title} aria-label="Deck title" onChange={(event) => updateDeck({ ...deck, title: event.target.value, updatedAt: new Date().toISOString() })} /><input className="flashcards-description-input" value={deck.description} aria-label="Deck description" placeholder="Add a description" onChange={(event) => updateDeck({ ...deck, description: event.target.value, updatedAt: new Date().toISOString() })} /></div><button className="flashcards-danger" onClick={deleteDeck}><Trash2 size={16} /> Delete</button></div>
        <nav className="flashcards-tabs" aria-label="Deck view"><button className={mode === "study" ? "is-active" : ""} onClick={() => setMode("study")}>Study</button><button className={mode === "cards" ? "is-active" : ""} onClick={() => setMode("cards")}>Cards <span>{deck.cards.length}</span></button></nav>
        {mode === "study" ? <section className="flashcards-study"><div className="flashcards-study-toolbar"><span>{reviewOnly ? "Review missed cards" : "Study all cards"}</span><div><button className={shuffled ? "toolbar-button is-active" : "toolbar-button"} onClick={() => setShuffled((value) => !value)}><Shuffle size={15} /> Shuffle</button>{missed > 0 && <button className="toolbar-button" onClick={() => setReviewOnly((value) => !value)}>{reviewOnly ? "All cards" : `Review missed (${missed})`}</button>}</div></div>{card ? <><div className="flashcards-progress"><span>{Math.min(index + 1, cards.length)} of {cards.length}</span><div><i style={{ width: `${((index + 1) / cards.length) * 100}%` }} /></div><span>{reviewed} reviewed</span></div><button className={`flashcard ${flipped ? "is-flipped" : ""}`} onClick={() => setFlipped((value) => !value)} aria-label={flipped ? "Card back. Click to show front" : "Card front. Click to reveal answer"}><span className="flashcard-label">{flipped ? "Answer" : "Prompt"}</span><strong>{flipped ? card.back : card.front}</strong><small>Click to {flipped ? "see prompt" : "reveal answer"}</small></button><div className="flashcards-study-actions"><button className="study-control" onClick={() => navigate(-1)} disabled={index === 0}><ChevronLeft size={18} /> Previous</button><button className="review-button" onClick={() => mark("review")} disabled={!flipped}>Needs review <span>1</span></button><button className="known-button" onClick={() => mark("known")} disabled={!flipped}><Check size={17} /> Know it <span>2</span></button><button className="study-control" onClick={() => navigate(1)} disabled={index >= cards.length - 1}>Next <ChevronRight size={18} /></button></div></> : <div className="flashcards-complete"><div className="flashcards-complete-icon"><Check size={27} /></div><h2>{reviewOnly ? "Review complete" : "Nice work"}</h2><p>You reached the end of this study session.</p><div><button className="flashcards-primary" onClick={() => { setReviewOnly(false); setIndex(0); }}><RotateCcw size={16} /> Start again</button>{missed > 0 && <button className="flashcards-secondary" onClick={() => { setReviewOnly(true); setIndex(0); }}>Review missed cards</button>}</div></div>}</section> : <section className="flashcards-card-manager"><div className="flashcards-add-card"><h2>{editingCardId ? "Edit card" : "Add a card"}</h2><div className="flashcards-editor-grid"><label>Front<textarea value={draft.front} onChange={(event) => setDraft({ ...draft, front: event.target.value })} placeholder="Question or prompt" /></label><label>Back<textarea value={draft.back} onChange={(event) => setDraft({ ...draft, back: event.target.value })} placeholder="Answer or explanation" /></label></div><button className="flashcards-primary" onClick={editingCardId ? saveCardEdit : addCard} disabled={!draft.front.trim() || !draft.back.trim()}>{editingCardId ? <><Check size={17} /> Save card</> : <><Plus size={17} /> Add card</>}</button></div><div className="flashcards-card-list">{deck.cards.map((item, cardIndex) => <article className="flashcards-card-row" key={item.id}><span>{cardIndex + 1}</span><div><strong>{item.front}</strong><p>{item.back}</p></div><div className="flashcards-card-actions"><button className="icon-button" onClick={() => { setEditingCardId(item.id); setDraft({ front: item.front, back: item.back }); }} aria-label={`Edit card ${cardIndex + 1}`}><Edit3 size={15} /></button><button className="icon-button" onClick={() => setStore((value) => ({ ...value, decks: value.decks.map((candidate) => candidate.id === deck.id ? { ...candidate, cards: candidate.cards.filter((candidateCard) => candidateCard.id !== item.id) } : candidate) }))} aria-label={`Delete card ${cardIndex + 1}`}><Trash2 size={15} /></button></div></article>)}</div></section>}
      </>}</main>
    </div>
  </div>;
}

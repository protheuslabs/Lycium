"use client";

import { useState, type CSSProperties } from "react";
import { ArrowLeft, BookOpen, ChevronDown, Download, FolderOpen, Library, Palette, Plus, Search, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import ToolFrame from "../Tools/ToolFrame";
import { createId, DECK_COLORS, MAX_CARDS, recordReview, removeDeck, replaceDeck, starterDeck, toggleStar, type FlashcardDeck } from "./flashcardDomain";
import { useFlashcardStore } from "./useFlashcardStore";
import { cardsFromText, deckFromPreview, downloadText, exportDeckCsv, exportDeckJson, type ImportPreview } from "./flashcardImport";
import FlashcardStudy from "./FlashcardStudy";
import FlashcardEditor from "./FlashcardEditor";
import FlashcardImportDialog from "./FlashcardImportDialog";
import "./flashcards.css";

export default function FlashcardsApp() {
  const { snapshot, commit } = useFlashcardStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<"study" | "cards">("study");
  const [importing, setImporting] = useState(false), [focused, setFocused] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false), [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const store = snapshot?.store;
  const activeId = selectedId ?? store?.decks[0]?.id;
  const deck = store?.decks.find((item) => item.id === activeId) ?? null;
  function selectDeck(id: string, view: "study" | "cards" = "study") {
    setSelectedId(id); setMode(view); setFocused(false); setSidebarOpen(false); setMessage("");
  }
  function createDeck() {
    if (!store) return;
    if (store.decks.length >= 100) { setMessage("Your library has reached its 100-deck limit. Export a deck before removing it."); return; }
    const now = new Date().toISOString();
    const next: FlashcardDeck = { id: createId("deck"), title: "New deck", description: "", color: DECK_COLORS[store.decks.length % DECK_COLORS.length].value, cards: [], createdAt: now, updatedAt: now };
    commit({ ...store, decks: [...store.decks, next] }); selectDeck(next.id, "cards");
  }
  function updateDeck(next: FlashcardDeck) {
    if (store) commit(replaceDeck(store, { ...next, updatedAt: new Date().toISOString() }));
  }
  function deleteSelectedDeck() {
    if (!deck || !store || !window.confirm("Delete “" + (deck.title || "Untitled deck") + "” and its review history? This cannot be undone. Export a backup first if needed.")) return;
    const next = removeDeck(store, deck.id);
    commit(next); setSelectedId(next.decks[0]?.id ?? null); setMode("study"); setFocused(false); setMessage("Deck deleted.");
  }
  function addStarter() {
    if (!store || store.decks.length >= 100) return;
    const next = deckFromPreview({ title: starterDeck.title, description: starterDeck.description, cards: starterDeck.cards, color: DECK_COLORS[0].value, duplicates: 0 });
    commit({ ...store, decks: [...store.decks, next] }); selectDeck(next.id);
  }
  function importCards(preview: ImportPreview, append: boolean) {
    if (!store) return;
    if (append && deck) {
      if (deck.cards.length + preview.cards.length > MAX_CARDS) { setMessage("Import would exceed 5,000 cards. Choose a new deck or import fewer cards."); return; }
      updateDeck({ ...deck, cards: [...deck.cards, ...cardsFromText(preview.cards)] }); setMode("cards");
    } else {
      if (store.decks.length >= 100) { setMessage("The library limit is 100 decks. Export and remove a deck before importing another."); return; }
      const next = deckFromPreview(preview);
      commit({ ...store, decks: [...store.decks, next] }); selectDeck(next.id, "cards");
    }
    setImporting(false); setMessage(preview.cards.length + " cards imported. Existing decks and review history were preserved.");
  }
  function exportSelected(format: "json" | "csv") {
    if (!deck) return;
    const name = (deck.title || "flashcard-deck").replace(/[^\p{L}\p{N}_-]+/gu, "-").slice(0, 80);
    downloadText(format === "json" ? exportDeckJson(deck) : exportDeckCsv(deck), name + "." + format, format === "json" ? "application/json" : "text/csv;charset=utf-8");
  }

  return (
    <div className={"flashcards-app" + (focused ? " fc-focused" : "")} style={{ "--fc-deck-color": deck?.color ?? DECK_COLORS[0].value } as CSSProperties} onClick={(event) => { for (const menu of event.currentTarget.querySelectorAll<HTMLDetailsElement>("details[open]")) { if (!menu.contains(event.target as Node)) menu.open = false; } }} onKeyDown={(event) => { if (event.key === "Escape" && !importing) { setFocused(false); for (const menu of event.currentTarget.querySelectorAll<HTMLDetailsElement>("details[open]")) menu.open = false; } }}>
      <a className="skip-link" href="#fc-main">Skip to flashcards</a>
      <header className="flashcards-header">
        <Link href="/tools" className="flashcards-back"><ArrowLeft size={16} aria-hidden="true" /><span>Back to Tools</span></Link>
        <h1>Flashcards</h1><p className="flashcards-workspace-description">A little practice. Lasting understanding.</p>
        <div className="fc-header-actions">
          <details className="fc-file-menu"><summary><FolderOpen size={16} /><span>File</span><ChevronDown size={14} /></summary><div className="fc-popover">
            <button disabled={!snapshot} onClick={() => setImporting(true)}><Upload size={16} /> Import cards…</button>
            <button disabled={!deck} onClick={() => exportSelected("json")}><Download size={16} /> Export deck JSON</button>
            <button disabled={!deck || !deck.cards.length} onClick={() => exportSelected("csv")}><Download size={16} /> Export cards CSV</button>
            <p>Deck files contain card content, without your personal review history.</p>
          </div></details>
          <button className="fc-button fc-primary" disabled={!store} onClick={createDeck}><Plus size={17} /> New deck</button>
        </div>
      </header>

      {snapshot?.error && <div className="fc-storage-warning" role="alert"><span>{snapshot.error}</span>{snapshot.raw && <button className="fc-text-button" onClick={() => downloadText(snapshot.raw ?? "", "lycium-flashcards-original-backup.json")}>Download original data</button>}</div>}
      <ToolFrame fill className="fc-workspace-frame">
        {!store ? <main id="fc-main" className="fc-loading" aria-busy="true"><Library size={24} /><p>Opening your decks…</p></main> : <>
          <button className="fc-mobile-library fc-button" aria-expanded={sidebarOpen} aria-controls="fc-sidebar" onClick={() => setSidebarOpen(!sidebarOpen)}><Library size={17} />{deck?.title || "My decks"}<ChevronDown size={16} /></button>
          <div className="flashcards-layout">
            <aside className={"flashcards-sidebar" + (sidebarOpen ? " is-open" : "")} id="fc-sidebar" aria-label="Flashcard decks">
              <div className="fc-sidebar-top"><h2>My decks <span>{store.decks.length}</span></h2><button className="fc-icon" onClick={createDeck} aria-label="Create deck"><Plus size={18} /></button></div>
              {store.decks.length > 3 && <label className="fc-search"><Search size={15} /><input type="search" aria-label="Find a deck" placeholder="Find a deck" value={query} onChange={(event) => setQuery(event.target.value)} /></label>}
              <div className="fc-deck-list">{store.decks.filter((item) => item.title.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map((item) => <button key={item.id} className={"fc-deck-item" + (item.id === activeId ? " is-selected" : "")} aria-current={item.id === activeId ? "true" : undefined} onClick={() => selectDeck(item.id)}>
                <span className="fc-deck-marker" style={{ backgroundColor: item.color ?? DECK_COLORS[0].value }} /><span><strong>{item.title || "Untitled deck"}</strong><small>{item.cards.length} {item.cards.length === 1 ? "card" : "cards"}</small></span>
              </button>)}</div>
              {!store.decks.length && <p className="fc-sidebar-empty">Your decks will appear here. Start with your own notes or a sample.</p>}
              <div className="fc-sidebar-bottom"><button className="fc-text-button" onClick={() => setImporting(true)}><Upload size={15} /> Import a deck</button><p><span className="fc-save-dot" />{snapshot.writable ? "Saved on this browser" : "Changes kept in memory"}</p><small>Export a backup to take your decks with you.</small></div>
            </aside>

            <main id="fc-main" tabIndex={-1} className="flashcards-main">
              {!deck ? <section className="fc-welcome"><span className="fc-welcome-icon"><BookOpen size={30} /></span><p className="fc-eyebrow">Make room for what matters</p><h2>Learn it. Recall it. Keep it.</h2><p>A focused place for your questions, definitions, and discoveries. Create a deck or bring in the notes you already have.</p><div className="fc-centered-actions"><button className="fc-button fc-primary" onClick={createDeck}><Plus size={17} /> Create a deck</button><button className="fc-button" onClick={() => setImporting(true)}><Upload size={16} /> Import notes</button></div><button className="fc-text-button" onClick={addStarter}>Try a chemistry sample →</button></section> : <>
                <div className="fc-deck-heading"><div className="fc-deck-title-fields"><label className="sr-only" htmlFor="fc-deck-title">Deck title</label><input id="fc-deck-title" className="fc-title-input" value={deck.title} placeholder="Untitled deck" maxLength={200} onChange={(event) => updateDeck({ ...deck, title: event.target.value })} onBlur={() => { if (!deck.title.trim()) updateDeck({ ...deck, title: "Untitled deck" }); }} /><label className="sr-only" htmlFor="fc-deck-description">Deck description</label><input id="fc-deck-description" className="fc-description-input" value={deck.description} maxLength={2000} placeholder="Add a description to your deck" onChange={(event) => updateDeck({ ...deck, description: event.target.value })} /></div>
                  <div className="fc-inline-actions"><details className="fc-color-menu"><summary aria-label="Deck color" title="Deck color"><Palette size={18} /></summary><div className="fc-popover"><h3>Deck color</h3><div className="fc-color-options">{DECK_COLORS.map((color) => <button key={color.value} aria-label={color.name + " deck color"} aria-pressed={(deck.color ?? DECK_COLORS[0].value) === color.value} style={{ background: color.value }} onClick={() => updateDeck({ ...deck, color: color.value })} />)}</div></div></details><button className="fc-icon" onClick={deleteSelectedDeck} aria-label="Delete deck" title="Delete deck"><Trash2 size={17} /></button></div>
                </div>
                <nav className="fc-tabs" aria-label="Deck view"><button aria-current={mode === "study" ? "page" : undefined} onClick={() => setMode("study")}><BookOpen size={16} /> Flashcards</button><button aria-current={mode === "cards" ? "page" : undefined} onClick={() => { setMode("cards"); setFocused(false); }}>Edit cards <span>{deck.cards.length}</span></button></nav>
                {mode === "study" ? <FlashcardStudy key={deck.id} deck={deck} history={store.history} onGrade={(cardId, grade) => commit(recordReview(store, deck.id, cardId, grade))} onStar={(cardId) => commit(toggleStar(store, deck.id, cardId))} onEdit={() => setMode("cards")} focused={focused} onFocus={() => setFocused(!focused)} /> :
                  <FlashcardEditor key={deck.id} deck={deck} reviews={store.history[deck.id] ?? {}} onUpdate={updateDeck} onImport={() => setImporting(true)} onStar={(cardId) => commit(toggleStar(store, deck.id, cardId))} announce={setMessage} />}
              </>}
            </main>
          </div>
        </>}
      </ToolFrame>
      <div className="fc-status" role="status">{message}</div>
      {importing && <FlashcardImportDialog deck={deck} deckCount={store?.decks.length ?? 0} onClose={() => setImporting(false)} onImport={importCards} />}
    </div>
  );
}

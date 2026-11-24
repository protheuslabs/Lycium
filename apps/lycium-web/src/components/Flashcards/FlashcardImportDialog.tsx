import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Upload, X } from "lucide-react";
import { MAX_CARDS, MAX_IMPORT_BYTES, type FlashcardDeck } from "./flashcardDomain";
import { duplicateCount, parseCardText, parseDeckJson, type ImportPreview } from "./flashcardImport";

type Props = { deck: FlashcardDeck | null; deckCount: number; onClose: () => void; onImport: (preview: ImportPreview, append: boolean) => void };

export default function FlashcardImportDialog({ deck, deckCount, onClose, onImport }: Props) {
  const dialog = useRef<HTMLDialogElement>(null), fileInput = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(""), [delimiter, setDelimiter] = useState<"\t" | "," | ";">("\t"), [skipHeader, setSkipHeader] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null), [error, setError] = useState("");
  const [append, setAppend] = useState(!!deck), [title, setTitle] = useState("Imported deck");
  useEffect(() => { const node = dialog.current; node?.showModal(); return () => node?.close(); }, []);
  function inspect() {
    try { const next = parseCardText(text, delimiter, skipHeader); setPreview(next); setError(""); }
    catch (failure) { setPreview(null); setError(failure instanceof Error ? failure.message : "Unable to read these cards."); }
  }
  async function readFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    setPreview(null); setError("");
    if (file.size > MAX_IMPORT_BYTES) { setError("Choose a file smaller than 8 MB."); return; }
    try {
      const content = await file.text(); setError("");
      if (file.name.toLowerCase().endsWith(".json")) { const next = parseDeckJson(content); setText(""); setPreview(next); setTitle(next.title); setAppend(false); }
      else { const separator = file.name.toLowerCase().endsWith(".csv") ? "," : "\t"; setText(content); setDelimiter(separator); setPreview(parseCardText(content, separator)); }
    } catch (failure) { setPreview(null); setError(failure instanceof Error ? failure.message : "Unable to read this file."); }
  }
  const duplicates = preview ? duplicateCount([...(append && deck ? deck.cards : []), ...preview.cards]) - (append && deck ? duplicateCount(deck.cards) : 0) : 0;
  const limitError = preview && append && deck && deck.cards.length + preview.cards.length > MAX_CARDS ? "This would exceed 5,000 cards. Import into a new deck instead." : !append && deckCount >= 100 ? "Your library has reached its 100-deck limit. Add these cards to an existing deck instead." : "";
  return <dialog ref={dialog} className="fc-dialog" aria-labelledby="fc-import-heading" onCancel={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="fc-dialog-header"><div><h2 id="fc-import-heading">Build a deck from your notes</h2><p>Paste two columns, or upload a CSV, TSV, or Lycium JSON file.</p></div><button className="fc-icon" onClick={onClose} aria-label="Close import"><X size={20} /></button></div>
    <div className="fc-dialog-body"><div className="fc-import-toolbar"><button className="fc-button" onClick={() => fileInput.current?.click()}><Upload size={16} /> Choose file</button><span className="fc-muted">Up to 8 MB · 5,000 cards per deck</span><input ref={fileInput} type="file" accept=".json,.csv,.tsv,.txt" aria-label="Import deck file" className="sr-only" onChange={readFile} /></div>
      <label className="fc-field">Term and definition pairs<textarea className="fc-import-text" value={text} onChange={(event) => { setText(event.target.value); setPreview(null); setError(""); }} placeholder={"Atomic number\tNumber of protons\nIsotope\tAtoms with different neutron counts"} /></label>
      <div className="fc-import-options"><label>Separate columns with <select aria-label="Column separator" value={delimiter} onChange={(event) => { setDelimiter(event.target.value as typeof delimiter); setPreview(null); }}><option value={"\t"}>Tab (spreadsheet)</option><option value=",">Comma (CSV)</option><option value=";">Semicolon</option></select></label><label><input type="checkbox" checked={skipHeader} onChange={(event) => { setSkipHeader(event.target.checked); setPreview(null); }} /> Skip first row</label><button className="fc-button" onClick={inspect} disabled={!text.trim()}>Preview cards</button></div>
      {error && <p className="fc-warning" role="alert">{error}</p>}
      {limitError && <p className="fc-warning" role="alert">{limitError}</p>}
      {preview && <div className="fc-import-preview"><div className="fc-section-heading"><h3>{preview.cards.length} cards ready</h3><span className="fc-muted">Preview of first {Math.min(5, preview.cards.length)}</span></div><div className="fc-preview-table"><table><thead><tr><th>Front</th><th>Back</th></tr></thead><tbody>{preview.cards.slice(0, 5).map((card, index) => <tr key={index}><td>{card.front}</td><td>{card.back}</td></tr>)}</tbody></table></div>{duplicates > 0 && <p className="fc-warning">{duplicates} exact duplicate {duplicates === 1 ? "pair" : "pairs"}. All copies will be kept so nothing is silently removed.</p>}<label className="fc-field">Import into<select value={append ? "current" : "new"} onChange={(event) => setAppend(event.target.value === "current")}>{deck && <option value="current">Add to {deck.title || "Untitled deck"}</option>}<option value="new">Create a new deck</option></select></label>{!append && <label className="fc-field">New deck title<input value={title} maxLength={200} onChange={(event) => setTitle(event.target.value)} /></label>}</div>}
    </div><div className="fc-dialog-footer"><button className="fc-button" onClick={onClose}>Cancel</button><button className="fc-button fc-primary" disabled={!preview || !!limitError || (!append && !title.trim())} onClick={() => { if (preview) onImport({ ...preview, title: title.trim() }, append); }}>Import {preview?.cards.length ?? ""} cards</button></div>
  </dialog>;
}

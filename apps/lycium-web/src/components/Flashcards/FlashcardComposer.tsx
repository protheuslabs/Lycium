import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, Plus, Upload } from "lucide-react";
import { MAX_SIDE_LENGTH } from "./flashcardDomain";
import type { CardText } from "./flashcardImport";

type Props = { initial?: CardText; number?: number; disabled?: boolean; onSave: (card: CardText) => void; onCancel?: () => void; onImport?: () => void };

/** Used both for successive creation and editing in the selected card row. */
export default function FlashcardComposer({ initial, number, disabled = false, onSave, onCancel, onImport }: Props) {
  const [draft, setDraft] = useState(initial ?? { front: "", back: "" });
  const front = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!initial) return;
    front.current?.closest("article")?.scrollIntoView({ block: "nearest", inline: "nearest" });
    front.current?.focus({ preventScroll: true });
  }, [initial]);
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft.front.trim() || !draft.back.trim() || disabled) return;
    onSave({ front: draft.front.trim(), back: draft.back.trim() });
    if (!initial) { setDraft({ front: "", back: "" }); front.current?.focus(); }
  }
  return <form className={initial ? "fc-inline-card-editor" : "fc-card-editor"} aria-label={initial ? "Edit card " + number : "Add a card"} onSubmit={submit} onKeyDown={(event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); event.currentTarget.requestSubmit(); }
    if (event.key === "Escape" && onCancel) { event.stopPropagation(); onCancel(); }
  }}>
    <div className="fc-section-heading"><h2>{initial ? "Edit card " + number : "Add a card"}</h2>{onImport && <button className="fc-text-button" type="button" onClick={onImport}><Upload size={15} /> Import in bulk</button>}</div>
    <div className="fc-editor-grid">
      <label>Front <span>Question or term</span><textarea ref={front} value={draft.front} maxLength={MAX_SIDE_LENGTH} onChange={(event) => setDraft({ ...draft, front: event.target.value })} placeholder="What do you want to remember?" required /></label>
      <label>Back <span>Answer or explanation</span><textarea value={draft.back} maxLength={MAX_SIDE_LENGTH} onChange={(event) => setDraft({ ...draft, back: event.target.value })} placeholder="Add the answer here" required /></label>
    </div>
    <div className="fc-editor-footer"><span className="fc-editor-shortcut fc-muted">⌘ / Ctrl + Enter to save{initial ? " · Esc to cancel" : ""}</span><div className="fc-inline-actions">{onCancel && <button className="fc-button" type="button" onClick={onCancel}>Cancel edit</button>}<button className="fc-button fc-primary" disabled={disabled || !draft.front.trim() || !draft.back.trim()}>{initial ? <Check size={16} /> : <Plus size={16} />}{initial ? "Save changes" : "Add card"}</button></div></div>
  </form>;
}

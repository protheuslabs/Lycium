import { useRef, useState } from "react";
import { Download, History } from "lucide-react";
import type { FlashcardStore } from "./flashcardDomain";
import { exportLibraryBackup, MAX_BACKUP_BYTES, parseLibraryBackup } from "./flashcardBackup";
import { downloadText } from "./flashcardImport";

type Props = { store: FlashcardStore | undefined; onRestore: (store: FlashcardStore) => void; announce: (message: string) => void };

export default function FlashcardBackupActions({ store, onRestore, announce }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function restore(file: File) {
    setBusy(true);
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error("Library backups must be under 32 MB.");
      const restored = parseLibraryBackup(await file.text());
      if (!window.confirm("Replace this browser’s flashcard library with " + restored.decks.length + " backed-up decks and their review history? Download a library backup first to keep the current library.")) return;
      onRestore(restored);
      announce("Library restored, including review schedules, history, and stars.");
    } catch (error) { announce(error instanceof Error ? error.message : "Unable to read this backup. Your library was not changed."); }
    finally { setBusy(false); }
  }
  return <>
    <button disabled={!store} onClick={() => { if (store) downloadText(exportLibraryBackup(store), "lycium-flashcards-library-" + new Date().toISOString().slice(0, 10) + ".json", "application/json"); }}><Download size={16} /> Back up library</button>
    <button disabled={!store || busy} onClick={() => input.current?.click()}><History size={16} />{busy ? "Reading backup…" : "Restore library…"}</button>
    <input ref={input} hidden type="file" accept=".json,application/json" aria-label="Restore library backup" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void restore(file); }} />
    <p>Library backups include all decks and personal review history. Deck exports contain only card content.</p>
  </>;
}

import { FLASHCARD_STORAGE_KEY, emptyStore, parseFlashcardStore, type FlashcardStore } from "./flashcardDomain";

type StoragePort = Pick<Storage, "getItem" | "setItem">;
export type StorageSnapshot = { store: FlashcardStore; raw: string | null; error: string | null; writable: boolean };

export function readFlashcards(storage: StoragePort): StorageSnapshot {
  let raw: string | null = null;
  try {
    raw = storage.getItem(FLASHCARD_STORAGE_KEY);
    return { store: raw ? parseFlashcardStore(JSON.parse(raw)) : emptyStore(), raw, error: null, writable: true };
  } catch {
    return { store: emptyStore(), raw, error: raw ? "Your saved decks could not be read. The original data has been preserved. Download a backup before making changes." : "Browser storage is unavailable. You can study here, but use File → Back up library before leaving.", writable: false };
  }
}

export function loadFlashcardStore(): StorageSnapshot {
  try { return readFlashcards(window.localStorage); }
  catch { return { store: emptyStore(), raw: null, error: "Browser storage is unavailable. Use File → Back up library before leaving.", writable: false }; }
}

/** Refuse to overwrite another tab's changes or unreadable existing data. */
export function writeFlashcards(storage: StoragePort, store: FlashcardStore, expectedRaw: string | null): string {
  if (storage.getItem(FLASHCARD_STORAGE_KEY) !== expectedRaw) throw new Error("Saved decks changed in another tab. Back up your library, then reload to load those changes.");
  const raw = JSON.stringify(store);
  storage.setItem(FLASHCARD_STORAGE_KEY, raw);
  return raw;
}

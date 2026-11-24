import { FLASHCARD_STORAGE_KEY, emptyStore, isFlashcardStore, type FlashcardStore } from "./flashcardDomain";

export function loadFlashcardStore(): FlashcardStore {
  if (typeof window === "undefined") return emptyStore();
  try {
    const raw = window.localStorage.getItem(FLASHCARD_STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed: unknown = JSON.parse(raw);
    return isFlashcardStore(parsed) ? parsed : emptyStore();
  } catch {
    return emptyStore();
  }
}

export function saveFlashcardStore(store: FlashcardStore): void {
  if (typeof window !== "undefined") window.localStorage.setItem(FLASHCARD_STORAGE_KEY, JSON.stringify(store));
}

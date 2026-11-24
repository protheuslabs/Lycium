import { parseFlashcardStore, record, type FlashcardStore } from "./flashcardDomain";

export const MAX_BACKUP_BYTES = 32 * 1024 * 1024;

/** Full personal backup, distinct from a shareable content-only deck export. */
export function exportLibraryBackup(store: FlashcardStore): string {
  return JSON.stringify({ format: "lycium-flashcards-backup-v1", store }, null, 2);
}

export function parseLibraryBackup(text: string): FlashcardStore {
  if (new Blob([text]).size > MAX_BACKUP_BYTES) throw new Error("Library backups must be under 32 MB.");
  const value: unknown = JSON.parse(text);
  if (!record(value) || value.format !== "lycium-flashcards-backup-v1") throw new Error("Choose a Lycium library backup. To add a deck instead, use Import cards.");
  return parseFlashcardStore(value.store);
}

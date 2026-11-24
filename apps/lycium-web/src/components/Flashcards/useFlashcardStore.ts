"use client";

import { useSyncExternalStore } from "react";
import type { FlashcardStore } from "./flashcardDomain";
import { loadFlashcardStore, writeFlashcards, type StorageSnapshot } from "./flashcardStorage";

let current: StorageSnapshot | null = null;
const listeners = new Set<() => void>();
const serverSnapshot = () => null;

function getSnapshot() {
  current ??= loadFlashcardStore();
  return current;
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
function commit(update: FlashcardStore | ((store: FlashcardStore) => FlashcardStore)) {
  const previous = getSnapshot();
  const store = typeof update === "function" ? update(previous.store) : update;
  let { raw, error, writable } = previous;
  if (writable) {
    try { raw = writeFlashcards(window.localStorage, store, raw); error = null; }
    catch (failure) {
      error = failure instanceof Error && failure.message.includes("another tab") ? failure.message : "Your changes are in memory, but could not be saved. Use File → Back up library before leaving this page.";
      writable = false;
    }
  }
  current = { store, raw, error, writable };
  for (const listener of listeners) listener();
}

/** Server rendering stays empty; storage is read once when the client subscribes. */
export function useFlashcardStore() {
  return { snapshot: useSyncExternalStore(subscribe, getSnapshot, serverSnapshot), commit };
}

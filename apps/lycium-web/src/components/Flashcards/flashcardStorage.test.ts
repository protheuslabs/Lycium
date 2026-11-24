import { describe, expect, it } from "vitest";
import { emptyStore, starterDeck } from "./flashcardDomain";
import { readFlashcards, writeFlashcards } from "./flashcardStorage";

function storage(initial: string | null = null) {
  let raw = initial;
  return { getItem: () => raw, setItem: (_key: string, value: string) => { raw = value; } };
}
describe("flashcard persistence", () => {
  it("loads compatible saved decks and writes after a user change", () => {
    const port = storage(JSON.stringify({ ...emptyStore(), decks: [starterDeck] }));
    const loaded = readFlashcards(port);
    expect(loaded.store.decks[0].cards).toHaveLength(3);
    const raw = writeFlashcards(port, loaded.store, loaded.raw);
    expect(readFlashcards(port).raw).toBe(raw);
  });
  it("preserves unreadable source data rather than replacing it", () => {
    const port = storage("not json"), loaded = readFlashcards(port);
    expect(loaded.writable).toBe(false); expect(loaded.raw).toBe("not json");
    expect(port.getItem()).toBe("not json");
  });
  it("refuses to overwrite changes from another tab", () => {
    const port = storage(), loaded = readFlashcards(port);
    port.setItem("", "other tab");
    expect(() => writeFlashcards(port, loaded.store, loaded.raw)).toThrow(/another tab/);
    expect(port.getItem()).toBe("other tab");
  });
  it("reports unavailable storage and propagates quota failures to the UI", () => {
    const broken = { getItem: () => { throw new Error("Unavailable"); }, setItem: () => {} };
    expect(readFlashcards(broken).error).toMatch(/unavailable/);
    expect(() => writeFlashcards({ getItem: () => null, setItem: () => { throw new Error("Quota"); } }, emptyStore(), null)).toThrow("Quota");
  });
});

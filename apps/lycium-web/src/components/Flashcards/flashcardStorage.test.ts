import { describe, expect, it } from "vitest";
import { emptyStore, starterDeck } from "./flashcardDomain";
import { readFlashcards, writeFlashcards } from "./flashcardStorage";
import { applyScheduledReview } from "./spacedReview";

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
  it("round-trips scheduled reviews and preserves corrupt scheduling data for recovery", async () => {
    const reviewed = await applyScheduledReview({ ...emptyStore(), decks: [starterDeck] }, starterDeck.id, starterDeck.cards[0].id, 3, new Date("2026-11-23T12:00:00Z"));
    const port = storage(), raw = writeFlashcards(port, reviewed, null);
    expect(readFlashcards(port).store.schedules).toEqual(reviewed.schedules);
    const invalid = raw.replace('"FSRS-7"', '"unsupported-model"');
    port.setItem("", invalid);
    const recovered = readFlashcards(port);
    expect(recovered.writable).toBe(false);
    expect(recovered.raw).toBe(invalid);
    expect(port.getItem()).toBe(invalid);
  });
});

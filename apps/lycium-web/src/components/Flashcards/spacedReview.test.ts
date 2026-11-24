import { describe, expect, it } from "vitest";
import { emptyStore, parseFlashcardStore, recordReview, removeDeck, replaceDeck, resetScheduledReview, starterDeck, toggleStar, type FlashcardStore } from "./flashcardDomain";
import { applyScheduledReview, previewReview, reviewAvailability, reviewInterval } from "./spacedReview";
import { exportLibraryBackup, parseLibraryBackup } from "./flashcardBackup";

const now = new Date("2026-11-23T12:00:00.000Z");
const deckId = starterDeck.id, cardId = starterDeck.cards[0].id;
const initial = (): FlashcardStore => ({ ...emptyStore(), decks: [structuredClone(starterDeck)] });

describe("FSRS scheduling", () => {
  it("uses all four ratings with fixed learning steps and deterministic previews", async () => {
    const options = await previewReview(cardId, undefined, now);
    expect(options).toEqual(await previewReview(cardId, undefined, now));
    expect(options.map((item) => item.rating)).toEqual([1, 2, 3, 4]);
    expect(options[0].dueAt).toBe("2026-11-23T12:01:00.000Z");
    expect(options[2].dueAt).toBe("2026-11-23T12:10:00.000Z");
    expect(Date.parse(options[3].dueAt)).toBeGreaterThan(Date.parse(options[2].dueAt));
    for (const option of options) {
      const reviewed = await applyScheduledReview(initial(), deckId, cardId, option.rating, now);
      expect(reviewed.schedules?.[deckId][cardId].memory.dueAt).toBe(option.dueAt);
      expect(reviewed.schedules?.[deckId][cardId].reviews).toEqual([{ at: now.toISOString(), rating: option.rating, dueAt: option.dueAt }]);
    }
  });

  it("separates new, due, and scheduled cards using the actual clock", async () => {
    const reviewed = await applyScheduledReview(initial(), deckId, cardId, 1, now);
    const schedule = reviewed.schedules ?? {};
    expect(reviewAvailability(starterDeck, schedule, now)).toEqual({ due: [], fresh: starterDeck.cards.slice(1).map((card) => card.id), later: [cardId], nextDue: "2026-11-23T12:01:00.000Z" });
    expect(reviewAvailability(starterDeck, schedule, new Date("2026-11-23T12:00:59Z")).due).toEqual([]);
    expect(reviewAvailability(starterDeck, schedule, new Date("2026-11-23T12:01:00Z")).due).toEqual([cardId]);
    await expect(applyScheduledReview(reviewed, deckId, cardId, 3, now)).rejects.toThrow("not due yet");
  });

  it("persists memory and genuine ratings across reloads and subsequent learning reviews", async () => {
    const first = await applyScheduledReview(initial(), deckId, cardId, 1, now);
    const restored = parseFlashcardStore(JSON.parse(JSON.stringify(first)));
    expect(restored.schedules).toEqual(first.schedules);
    const at = new Date(restored.schedules![deckId][cardId].memory.dueAt);
    const second = await applyScheduledReview(restored, deckId, cardId, 3, at);
    const memory = second.schedules![deckId][cardId];
    expect(memory.memory.reps).toBe(2);
    expect(memory.memory.lastReviewAt).toBe(at.toISOString());
    expect(Date.parse(memory.memory.dueAt)).toBeGreaterThan(at.getTime());
    expect(memory.reviews.map((item) => item.rating)).toEqual([1, 3]);
    expect(parseFlashcardStore(JSON.parse(JSON.stringify(second))).schedules).toEqual(second.schedules);
  });

  it("does not turn legacy Known/Needs review into invented FSRS ratings", async () => {
    const casual = recordReview(initial(), deckId, cardId, "known");
    const legacy = parseFlashcardStore(JSON.parse(JSON.stringify(casual)));
    expect(legacy.schedules).toBeUndefined();
    expect(reviewAvailability(starterDeck, legacy.schedules ?? {}, now).fresh).toHaveLength(3);
    const scheduled = await applyScheduledReview(legacy, deckId, cardId, 3, now);
    expect(scheduled.history).toEqual(casual.history);
    const freeStudy = recordReview(toggleStar(scheduled, deckId, cardId), deckId, cardId, "review");
    expect(freeStudy.schedules).toBe(scheduled.schedules);
    expect(freeStudy.history[deckId][cardId].starred).toBe(true);
  });

  it("preserves unrelated schedules and cleans orphan records on removal", async () => {
    const first = await applyScheduledReview(initial(), deckId, cardId, 4, now);
    const secondId = starterDeck.cards[1].id;
    const second = await applyScheduledReview(first, deckId, secondId, 3, now);
    expect(second.schedules?.[deckId][cardId]).toEqual(first.schedules?.[deckId][cardId]);
    const removed = replaceDeck(second, { ...starterDeck, cards: starterDeck.cards.slice(1) });
    expect(removed.schedules?.[deckId][cardId]).toBeUndefined();
    expect(removed.schedules?.[deckId][secondId]).toBeDefined();
    expect(removeDeck(second, deckId).schedules).toEqual({});
    await expect(applyScheduledReview(removed, deckId, cardId, 3, now)).rejects.toThrow("no longer exists");
  });

  it("resets one edited card without changing other review memory", async () => {
    const first = await applyScheduledReview(initial(), deckId, cardId, 3, now);
    const second = await applyScheduledReview(first, deckId, starterDeck.cards[1].id, 4, now);
    const reset = resetScheduledReview(second, deckId, cardId);
    expect(reset.schedules?.[deckId]?.[cardId]).toBeUndefined();
    expect(reset.schedules?.[deckId]?.[starterDeck.cards[1].id]).toEqual(second.schedules?.[deckId]?.[starterDeck.cards[1].id]);
    expect(reset.history).toEqual(second.history);
    expect(resetScheduledReview(reset, deckId, cardId)).toBe(reset);
  });

  it("rejects invalid clocks, ratings, and persisted memory without resetting user data", async () => {
    await expect(applyScheduledReview(initial(), deckId, cardId, 3, new Date("invalid"))).rejects.toThrow("Invalid review");
    const valid = await applyScheduledReview(initial(), deckId, cardId, 3, now);
    for (const change of [{ stability: -1 }, { reps: -1 }, { dueAt: "invalid" }, { cardId: "wrong" }, { difficulty: 20 }, { state: 9 }]) {
      const malformed = structuredClone(valid);
      Object.assign(malformed.schedules![deckId][cardId].memory, change);
      expect(() => parseFlashcardStore(malformed)).toThrow("Invalid spaced-review");
    }
    const unsupported = structuredClone(valid);
    Object.assign(unsupported.schedules![deckId][cardId], { model: "unknown" });
    expect(() => parseFlashcardStore(unsupported)).toThrow("Unsupported spaced-review");
    const badRating = structuredClone(valid);
    Object.assign(badRating.schedules![deckId][cardId].reviews[0], { rating: 0 });
    expect(() => parseFlashcardStore(badRating)).toThrow("Invalid scheduled review");
  });

  it("keeps full review history in personal backups, not in deck imports", async () => {
    const reviewed = await applyScheduledReview(toggleStar(initial(), deckId, cardId), deckId, cardId, 4, now);
    const backup = exportLibraryBackup(reviewed);
    const restored = parseLibraryBackup(backup);
    expect(restored.decks).toEqual(reviewed.decks);
    expect(restored.history).toEqual(reviewed.history);
    expect(restored.schedules).toEqual(reviewed.schedules);
    expect(() => parseLibraryBackup(JSON.stringify(starterDeck))).toThrow("library backup");
    expect(() => parseLibraryBackup('{"format":"lycium-flashcards-backup-v1","store":{"version":99}}')).toThrow();
  });

  it("formats review intervals in human-readable units", () => {
    expect(reviewInterval("2026-11-23T12:01:00Z", now)).toBe("1 min");
    expect(reviewInterval("2026-11-23T14:00:00Z", now)).toBe("2 hr");
    expect(reviewInterval("2026-11-24T12:00:00Z", now)).toBe("1 day");
  });
});

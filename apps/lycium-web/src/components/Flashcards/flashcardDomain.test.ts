import { describe, expect, it } from "vitest";
import { createStudySession, emptyStore, recordReview, sessionSummary, shuffleCards, starterDeck } from "./flashcardDomain";

describe("flashcard study domain", () => {
  it("uses a stable unbiased shuffle helper", () => {
    expect(shuffleCards([1, 2, 3, 4], () => .99)).toEqual([1, 2, 3, 4]);
    expect(shuffleCards([1, 2, 3, 4], () => 0)).toEqual([2, 3, 4, 1]);
  });

  it("keeps the session sequence independent from review changes", () => {
    const store = emptyStore();
    const session = createStudySession(starterDeck, store.history, true, false);
    const reviewed = recordReview({ ...store, history: { [starterDeck.id]: { [starterDeck.cards[0].id]: { status: "review", reviewCount: 1 } } } }, starterDeck.id, starterDeck.cards[0].id, "known");
    expect(createStudySession(starterDeck, reviewed.history, true, false).cardIds).toEqual([]);
    expect(session.cardIds).toHaveLength(0);
  });

  it("summarizes only cards in the session", () => {
    const session = createStudySession(starterDeck, {}, false, false);
    const store = recordReview(recordReview(emptyStore(), starterDeck.id, starterDeck.cards[0].id, "known"), starterDeck.id, starterDeck.cards[1].id, "review");
    const completed = { ...session, position: 2 };
    expect(sessionSummary(completed, starterDeck.id, store.history)).toMatchObject({ studied: 2, known: 1, needsReview: 1 });
  });
});

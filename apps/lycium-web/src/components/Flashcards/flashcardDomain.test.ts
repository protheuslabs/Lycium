import { describe, expect, it } from "vitest";
import { emptyStore, moveCard, parseFlashcardStore, recordReview, removeDeck, replaceDeck, starterDeck, toggleStar } from "./flashcardDomain";
import { createStudySession, restartSession, sessionReducer, sessionSummary, studyShortcut } from "./flashcardSession";

describe("flashcard study domain", () => {
  const initial = () => ({ ...emptyStore(), decks: [structuredClone(starterDeck)] });
  const grade = (session: ReturnType<typeof createStudySession>, value: "known" | "review" = "known") => sessionReducer(sessionReducer(session, { type: "flip" }), { type: "grade", grade: value });

  it("shuffles once and preserves every card during grading", () => {
    let session = createStudySession(starterDeck, {}, "all", true, () => 0);
    const order = [...session.cardIds];
    expect(order).not.toEqual(starterDeck.cards.map((card) => card.id));
    expect(new Set(order).size).toBe(starterDeck.cards.length);
    for (let i = 0; i < order.length; i++) session = grade(session);
    expect(session.cardIds).toEqual(order);
    expect(session.completed).toBe(true);
  });

  it("keeps the session sequence independent from review changes", () => {
    let store = initial();
    for (const card of starterDeck.cards) store = recordReview(store, starterDeck.id, card.id, "review");
    const session = createStudySession(starterDeck, store.history, "missed");
    const reviewed = recordReview(store, starterDeck.id, starterDeck.cards[0].id, "known");
    expect(createStudySession(starterDeck, reviewed.history, "missed").cardIds).toHaveLength(2);
    expect(grade(session).cardIds).toEqual(session.cardIds);
    expect(grade(session).position).toBe(1);
  });

  it("summarizes only cards in the session", () => {
    let session = createStudySession(starterDeck, {});
    session = grade(session);
    session = sessionReducer(session, { type: "move", delta: -1 });
    session = grade(session, "review");
    expect(sessionSummary(session)).toMatchObject({ studied: 2, graded: 1, known: 0, needsReview: 1 });
    session = grade(grade(session));
    expect(session.completed).toBe(true);
    expect(sessionSummary(session)).toEqual({ studied: 3, graded: 3, known: 2, needsReview: 1, percentage: 67 });
  });

  it("returns to skipped cards instead of prematurely completing", () => {
    let session = createStudySession(starterDeck, {});
    session = sessionReducer(session, { type: "move", delta: 2 });
    session = grade(session);
    expect(session.position).toBe(0);
    expect(session.completed).toBe(false);
  });

  it("starts a new session with no inherited grades or revealed answers", () => {
    const complete = grade(grade(grade(createStudySession(starterDeck, {}))));
    const fresh = sessionReducer(complete, { type: "start", session: createStudySession(starterDeck, {}) });
    expect(fresh).toMatchObject({ position: 0, flipped: false, completed: false, grades: {} });
    expect(sessionSummary(fresh).graded).toBe(0);
  });

  it("restarts the same missed-card round after every card is marked known", () => {
    const missed = recordReview(initial(), starterDeck.id, starterDeck.cards[0].id, "review");
    const session = grade(createStudySession(starterDeck, missed.history, "missed"));
    expect(restartSession(session).cardIds).toEqual(session.cardIds);
    expect(restartSession(session)).toMatchObject({ completed: false, grades: {}, position: 0 });
  });

  it("handles empty decks without treating them as completed rounds", () => {
    const session = createStudySession({ ...starterDeck, cards: [] }, {});
    expect(session.cardIds).toEqual([]);
    expect(session.completed).toBe(false);
    expect(sessionReducer(session, { type: "grade", grade: "known" })).toEqual(session);
  });

  it("blocks grading unrevealed answers in the reducer and keyboard adapter", () => {
    const session = createStudySession(starterDeck, {});
    expect(sessionReducer(session, { type: "grade", grade: "known" })).toEqual(session);
    expect(studyShortcut("2", false, false)).toBeNull();
    expect(studyShortcut("2", true, true)).toBeNull();
    expect(studyShortcut("2", true, false)).toEqual({ type: "grade", grade: "known" });
  });

  it("keeps favorites independent from grades and filters them at session start", () => {
    const store = toggleStar(initial(), starterDeck.id, starterDeck.cards[0].id);
    expect(createStudySession(starterDeck, store.history, "starred").cardIds).toEqual([starterDeck.cards[0].id]);
    expect(recordReview(store, starterDeck.id, starterDeck.cards[0].id, "known").history[starterDeck.id][starterDeck.cards[0].id].starred).toBe(true);
  });

  it("cleans review records on card or deck deletion and supports reordering", () => {
    const store = recordReview(initial(), starterDeck.id, starterDeck.cards[0].id, "review");
    const changed = replaceDeck(store, { ...starterDeck, title: "Renamed", cards: starterDeck.cards.slice(1) });
    expect(changed.decks[0].title).toBe("Renamed");
    expect(changed.history[starterDeck.id]).toEqual({});
    const moved = moveCard(starterDeck, starterDeck.cards[0].id, 1);
    expect(moved.cards[1].id).toBe(starterDeck.cards[0].id);
    expect(removeDeck(store, starterDeck.id)).toEqual(emptyStore());
  });

  it("reads original v1 decks and migrates missing metadata without changing IDs", () => {
    const legacy = { version: 1, decks: [{ ...starterDeck, description: undefined, createdAt: undefined }], history: {} };
    const migrated = parseFlashcardStore(legacy);
    expect(migrated.decks[0].id).toBe(starterDeck.id);
    expect(migrated.decks[0].description).toBe("");
  });

  it("rejects invalid history and duplicate card IDs", () => {
    expect(() => parseFlashcardStore({ ...initial(), history: { [starterDeck.id]: { [starterDeck.cards[0].id]: { status: "bogus", reviewCount: -1 } } } })).toThrow();
    expect(() => parseFlashcardStore({ ...initial(), decks: [{ ...starterDeck, cards: [starterDeck.cards[0], starterDeck.cards[0]] }] })).toThrow();
  });
});

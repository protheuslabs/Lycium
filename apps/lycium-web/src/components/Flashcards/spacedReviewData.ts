import type { FlashcardDeck } from "./flashcardDomain";

export type ReviewRating = 1 | 2 | 3 | 4;
export type ReviewMemory = {
  cardId: string;
  dueAt: string;
  lastReviewAt: string | null;
  stability: number;
  stabilityFast: number;
  difficulty: number;
  state: 0 | 1 | 2 | 3;
  scheduleStatus: "new" | "learning" | "review";
  reps: number;
  lapses: number;
  scheduledDays: number;
  learningStep: number;
};
export type ScheduledReview = {
  version: 1;
  model: "FSRS-7";
  memory: ReviewMemory;
  reviews: Array<{ at: string; rating: ReviewRating; dueAt: string }>;
};
export type ReviewSchedule = Record<string, Record<string, ScheduledReview>>;

function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function date(value: unknown): value is string { return typeof value === "string" && Number.isFinite(Date.parse(value)); }
function nonnegative(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value) && value >= 0; }
function integer(value: unknown): value is number { return nonnegative(value) && Number.isSafeInteger(value); }

export function parseReviewMemory(value: unknown, cardId: string): ReviewMemory {
  if (!object(value) || value.cardId !== cardId || !date(value.dueAt) || (value.lastReviewAt !== null && !date(value.lastReviewAt)) ||
    !nonnegative(value.stability) || !nonnegative(value.stabilityFast) || !nonnegative(value.difficulty) || value.difficulty > 10 ||
    (value.state !== 0 && value.state !== 1 && value.state !== 2 && value.state !== 3) || !integer(value.reps) || !integer(value.lapses) || value.lapses > value.reps ||
    !nonnegative(value.scheduledDays) || !integer(value.learningStep) ||
    (value.scheduleStatus !== "new" && value.scheduleStatus !== "learning" && value.scheduleStatus !== "review")) throw new Error("Invalid spaced-review memory state.");
  return { cardId, dueAt: value.dueAt, lastReviewAt: value.lastReviewAt, stability: value.stability, stabilityFast: value.stabilityFast, difficulty: value.difficulty, state: value.state, scheduleStatus: value.scheduleStatus, reps: value.reps, lapses: value.lapses, scheduledDays: value.scheduledDays, learningStep: value.learningStep };
}

/** Optional v1 extension. Older casual history remains untouched; no ratings are invented. */
export function parseReviewSchedule(value: unknown, decks: FlashcardDeck[]): ReviewSchedule {
  if (value === undefined) return {};
  if (!object(value)) throw new Error("Invalid spaced-review schedules.");
  return Object.fromEntries(decks.map((deck) => {
    const entries = Object.hasOwn(value, deck.id) ? value[deck.id] : undefined;
    if (entries !== undefined && !object(entries)) throw new Error("Invalid deck review schedules.");
    return [deck.id, Object.fromEntries(deck.cards.flatMap((card) => {
      const entry = entries && Object.hasOwn(entries, card.id) ? entries[card.id] : undefined;
      if (entry === undefined) return [];
      if (!object(entry) || entry.version !== 1 || entry.model !== "FSRS-7" || !Array.isArray(entry.reviews)) throw new Error("Unsupported spaced-review version.");
      const memory = parseReviewMemory(entry.memory, card.id);
      const reviews = entry.reviews.map((log: unknown): ScheduledReview["reviews"][number] => {
        if (!object(log) || !date(log.at) || !date(log.dueAt) || (log.rating !== 1 && log.rating !== 2 && log.rating !== 3 && log.rating !== 4)) throw new Error("Invalid scheduled review history.");
        return { at: log.at, rating: log.rating, dueAt: log.dueAt };
      });
      return [[card.id, { version: 1 as const, model: "FSRS-7" as const, memory, reviews }]];
    }))];
  }));
}

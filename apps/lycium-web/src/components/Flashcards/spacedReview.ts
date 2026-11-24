import { DefaultScheduler } from "ts-fsrs";
import type { FlashcardDeck, FlashcardStore } from "./flashcardDomain";
import type { ReviewMemory, ReviewRating, ReviewSchedule, ScheduledReview } from "./spacedReviewData";

function createScheduler() {
  return DefaultScheduler({ version: "FSRS-7", desiredRetention: .9, enableFuzz: false, learningSteps: ["1m", "10m"], relearningSteps: ["10m"], allowModelOverride: false, maximumInterval: 36500 });
}
type Scheduler = Awaited<ReturnType<typeof createScheduler>>;
type Memory = ReturnType<Scheduler["newCard"]>;
let scheduler: Promise<Scheduler> | undefined;

export const RATING_LABELS: Record<ReviewRating, string> = { 1: "Again", 2: "Hard", 3: "Good", 4: "Easy" };
export function getReviewScheduler() {
  scheduler ??= createScheduler();
  return scheduler;
}
function serialize(memory: Memory): ReviewMemory {
  return { ...memory, cardId: String(memory.cardId), dueAt: memory.dueAt.toISOString(), lastReviewAt: memory.lastReviewAt?.toISOString() ?? null };
}
function hydrate(saved: ReviewMemory): Memory {
  return { ...saved, dueAt: new Date(saved.dueAt), lastReviewAt: saved.lastReviewAt ? new Date(saved.lastReviewAt) : null };
}

export function reviewAvailability(deck: FlashcardDeck, schedule: ReviewSchedule, now: Date) {
  const due: string[] = [], fresh: string[] = [], later: string[] = [];
  let nextDue: string | null = null;
  for (const card of deck.cards) {
    const saved = schedule[deck.id]?.[card.id];
    if (!saved) fresh.push(card.id);
    else if (Date.parse(saved.memory.dueAt) <= now.getTime()) due.push(card.id);
    else { later.push(card.id); if (!nextDue || Date.parse(saved.memory.dueAt) < Date.parse(nextDue)) nextDue = saved.memory.dueAt; }
  }
  due.sort((a, b) => Date.parse(schedule[deck.id][a].memory.dueAt) - Date.parse(schedule[deck.id][b].memory.dueAt));
  return { due, fresh, later, nextDue };
}

export async function previewReview(cardId: string, saved: ScheduledReview | undefined, now: Date) {
  const engine = await getReviewScheduler();
  const card = saved ? hydrate(saved.memory) : engine.newCard({ cardId, now });
  return [...engine.preview({ card, now })].map((result) => ({ rating: result.grade as ReviewRating, dueAt: result.card.dueAt.toISOString() }));
}

/** Caller supplies the clock. Casual Known/Needs review records are never consulted. */
export async function applyScheduledReview(store: FlashcardStore, deckId: string, cardId: string, rating: ReviewRating, now: Date): Promise<FlashcardStore> {
  if (![1, 2, 3, 4].includes(rating) || !Number.isFinite(now.getTime())) throw new Error("Invalid review rating or time.");
  if (!store.decks.some((deck) => deck.id === deckId && deck.cards.some((card) => card.id === cardId))) throw new Error("The reviewed card no longer exists.");
  const previous = store.schedules?.[deckId]?.[cardId];
  if (previous && Date.parse(previous.memory.dueAt) > now.getTime()) throw new Error("This card is not due yet. Use Flashcards for free study.");
  const engine = await getReviewScheduler();
  const card = previous ? hydrate(previous.memory) : engine.newCard({ cardId, now });
  const result = engine.review({ card, grade: rating, now });
  const memory = serialize(result.card);
  const record: ScheduledReview = { version: 1, model: "FSRS-7", memory, reviews: [...(previous?.reviews ?? []), { at: now.toISOString(), rating, dueAt: memory.dueAt }] };
  return { ...store, schedules: { ...store.schedules, [deckId]: { ...store.schedules?.[deckId], [cardId]: record } } };
}

export function reviewInterval(dueAt: string, now: Date): string {
  const minutes = Math.max(1, Math.round((Date.parse(dueAt) - now.getTime()) / 60000));
  if (minutes < 60) return minutes + " min";
  if (minutes < 1440) return Math.round(minutes / 60) + " hr";
  const days = Math.round(minutes / 1440);
  return days === 1 ? "1 day" : days + " days";
}

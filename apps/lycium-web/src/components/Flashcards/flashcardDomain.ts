export type Flashcard = {
  id: string;
  front: string;
  back: string;
  createdAt: string;
  updatedAt: string;
};

export type FlashcardDeck = {
  id: string;
  title: string;
  description: string;
  cards: Flashcard[];
  createdAt: string;
  updatedAt: string;
};

export type ReviewStatus = "unseen" | "known" | "review";

export type FlashcardReview = {
  status: ReviewStatus;
  reviewCount: number;
  lastReviewedAt?: string;
};

export type FlashcardHistory = Record<string, Record<string, FlashcardReview>>;

export type FlashcardStore = {
  version: 1;
  decks: FlashcardDeck[];
  history: FlashcardHistory;
};

export const FLASHCARD_STORAGE_KEY = "lycium-flashcards-v1";

export const starterDeck: FlashcardDeck = {
  id: "starter-chemistry",
  title: "Chemistry fundamentals",
  description: "A few essentials to get started.",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  cards: [
    { id: "chemistry-1", front: "What is the atomic number of an element?", back: "The number of protons in its nucleus.", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
    { id: "chemistry-2", front: "What does pH measure?", back: "The acidity or basicity of an aqueous solution.", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
    { id: "chemistry-3", front: "What is the formula for water?", back: "H₂O.", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
  ],
};

export function emptyStore(): FlashcardStore {
  return { version: 1, decks: [], history: {} };
}

export function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function isFlashcardStore(value: unknown): value is FlashcardStore {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<FlashcardStore>;
  return candidate.version === 1 && Array.isArray(candidate.decks) && !!candidate.history && typeof candidate.history === "object" && candidate.decks.every(isDeck);
}

function isDeck(value: unknown): value is FlashcardDeck {
  if (!value || typeof value !== "object") return false;
  const deck = value as Partial<FlashcardDeck>;
  return typeof deck.id === "string" && typeof deck.title === "string" && typeof deck.description === "string" && Array.isArray(deck.cards) && deck.cards.every(isCard);
}

function isCard(value: unknown): value is Flashcard {
  if (!value || typeof value !== "object") return false;
  const card = value as Partial<Flashcard>;
  return typeof card.id === "string" && typeof card.front === "string" && typeof card.back === "string" && typeof card.createdAt === "string" && typeof card.updatedAt === "string";
}

export function recordReview(store: FlashcardStore, deckId: string, cardId: string, status: Exclude<ReviewStatus, "unseen">): FlashcardStore {
  const next = structuredClone(store);
  next.history[deckId] ??= {};
  const previous = next.history[deckId][cardId];
  next.history[deckId][cardId] = { status, reviewCount: (previous?.reviewCount ?? 0) + 1, lastReviewedAt: new Date().toISOString() };
  return next;
}

export function studyCards(deck: FlashcardDeck, history: FlashcardHistory, reviewOnly = false): Flashcard[] {
  const cards = reviewOnly ? deck.cards.filter((card) => history[deck.id]?.[card.id]?.status === "review") : [...deck.cards];
  return cards;
}

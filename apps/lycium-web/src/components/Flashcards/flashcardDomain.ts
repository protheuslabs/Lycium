import { parseReviewSchedule, type ReviewSchedule } from "./spacedReviewData";

export type Flashcard = {
  id: string;
  front: string;
  back: string;
  createdAt: string;
  updatedAt: string;
};

export type FlashcardDeck = {
  id: string;
  color?: string;
  title: string;
  description: string;
  cards: Flashcard[];
  createdAt: string;
  updatedAt: string;
};

export type ReviewStatus = "unseen" | "known" | "review";

export type FlashcardReview = {
  status: ReviewStatus;
  starred?: boolean;
  reviewCount: number;
  lastReviewedAt?: string;
};

export type FlashcardHistory = Record<string, Record<string, FlashcardReview>>;

export type FlashcardStore = {
  version: 1;
  decks: FlashcardDeck[];
  history: FlashcardHistory;
  schedules?: ReviewSchedule;
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

export const DECK_COLORS = [
  { name: "Teal", value: "#126f75" }, { name: "Blue", value: "#3978bc" },
  { name: "Violet", value: "#8060b5" }, { name: "Amber", value: "#b77819" },
  { name: "Rose", value: "#b85376" }, { name: "Slate", value: "#657b85" },
];
export const MAX_CARDS = 5000;
export const MAX_SIDE_LENGTH = 20000;
export const MAX_IMPORT_BYTES = 8 * 1024 * 1024;

export function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function parseDeck(value: unknown): FlashcardDeck {
  if (!record(value) || typeof value.id !== "string" || !value.id || value.id.length > 200 ||
    typeof value.title !== "string" || value.title.length > 200 ||
    (value.description !== undefined && (typeof value.description !== "string" || value.description.length > 2000)) ||
    !Array.isArray(value.cards) || value.cards.length > MAX_CARDS) throw new Error("Invalid deck. Use a title under 200 characters and at most 5,000 cards.");
  const date = typeof value.createdAt === "string" ? value.createdAt : "1970-01-01T00:00:00.000Z";
  const ids = new Set<string>();
  const cards = value.cards.map((card: unknown): Flashcard => {
    if (!record(card) || typeof card.id !== "string" || !card.id || card.id.length > 200 || ids.has(card.id) ||
      typeof card.front !== "string" || typeof card.back !== "string" ||
      !card.front.trim() || !card.back.trim() || card.front.length > MAX_SIDE_LENGTH || card.back.length > MAX_SIDE_LENGTH) throw new Error("Cards need unique identifiers and text on both sides (up to 20,000 characters each).");
    ids.add(card.id);
    return { id: card.id, front: card.front, back: card.back, createdAt: typeof card.createdAt === "string" ? card.createdAt : date, updatedAt: typeof card.updatedAt === "string" ? card.updatedAt : date };
  });
  if (value.color !== undefined && (typeof value.color !== "string" || !/^#[0-9a-f]{6}$/i.test(value.color))) throw new Error("Invalid deck color.");
  return { id: value.id, title: value.title, description: typeof value.description === "string" ? value.description : "", cards, createdAt: date, updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : date, ...(typeof value.color === "string" ? { color: value.color } : {}) };
}

/** Read v1 decks, including early exports with missing optional deck metadata. */
export function parseFlashcardStore(value: unknown): FlashcardStore {
  if (!record(value) || value.version !== 1 || !Array.isArray(value.decks) || value.decks.length > 100 || !record(value.history)) throw new Error("Unsupported or invalid flashcard storage.");
  const decks = value.decks.map(parseDeck);
  if (new Set(decks.map((deck) => deck.id)).size !== decks.length) throw new Error("Duplicate deck identifiers.");
  const rawHistory = value.history;
  const history: FlashcardHistory = Object.fromEntries(decks.map((deck) => {
    const raw = Object.hasOwn(rawHistory, deck.id) ? rawHistory[deck.id] : undefined;
    if (raw !== undefined && !record(raw)) throw new Error("Invalid review history.");
    return [deck.id, Object.fromEntries(deck.cards.flatMap((card) => {
      const item = raw && Object.hasOwn(raw, card.id) ? raw[card.id] : undefined;
      if (item === undefined) return [];
      if (!record(item) || (item.status !== "unseen" && item.status !== "known" && item.status !== "review") ||
        typeof item.reviewCount !== "number" || !Number.isSafeInteger(item.reviewCount) || item.reviewCount < 0 ||
        (item.starred !== undefined && typeof item.starred !== "boolean") ||
        (item.lastReviewedAt !== undefined && typeof item.lastReviewedAt !== "string")) throw new Error("Invalid card review record.");
      return [[card.id, { status: item.status, reviewCount: item.reviewCount, ...(item.starred !== undefined ? { starred: item.starred } : {}), ...(item.lastReviewedAt !== undefined ? { lastReviewedAt: item.lastReviewedAt } : {}) }]];
    }))];
  }));
  return { version: 1, decks, history, ...(value.schedules === undefined ? {} : { schedules: parseReviewSchedule(value.schedules, decks) }) };
}

export function isFlashcardStore(value: unknown): value is FlashcardStore {
  try { parseFlashcardStore(value); return true; } catch { return false; }
}

export function recordReview(store: FlashcardStore, deckId: string, cardId: string, status: Exclude<ReviewStatus, "unseen">): FlashcardStore {
  if (!store.decks.some((deck) => deck.id === deckId && deck.cards.some((card) => card.id === cardId))) return store;
  const previous = store.history[deckId]?.[cardId];
  return { ...store, history: { ...store.history, [deckId]: { ...store.history[deckId], [cardId]: { ...previous, status, reviewCount: (previous?.reviewCount ?? 0) + 1, lastReviewedAt: new Date().toISOString() } } } };
}

export function studyCards(deck: FlashcardDeck, history: FlashcardHistory, reviewOnly = false): Flashcard[] {
  const cards = reviewOnly ? deck.cards.filter((card) => history[deck.id]?.[card.id]?.status === "review") : [...deck.cards];
  return cards;
}

export function shuffleCards<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export function replaceDeck(store: FlashcardStore, deck: FlashcardDeck): FlashcardStore {
  const ids = new Set(deck.cards.map((card) => card.id));
  return { ...store, decks: store.decks.map((item) => item.id === deck.id ? deck : item), history: { ...store.history, [deck.id]: Object.fromEntries(Object.entries(store.history[deck.id] ?? {}).filter(([id]) => ids.has(id))) }, ...(store.schedules ? { schedules: { ...store.schedules, [deck.id]: Object.fromEntries(Object.entries(store.schedules[deck.id] ?? {}).filter(([id]) => ids.has(id))) } } : {}) };
}

export function removeDeck(store: FlashcardStore, id: string): FlashcardStore {
  return { ...store, decks: store.decks.filter((deck) => deck.id !== id), history: Object.fromEntries(Object.entries(store.history).filter(([key]) => key !== id)), ...(store.schedules ? { schedules: Object.fromEntries(Object.entries(store.schedules).filter(([key]) => key !== id)) } : {}) };
}

export function toggleStar(store: FlashcardStore, deckId: string, cardId: string): FlashcardStore {
  const previous = store.history[deckId]?.[cardId] ?? { status: "unseen" as const, reviewCount: 0 };
  return { ...store, history: { ...store.history, [deckId]: { ...store.history[deckId], [cardId]: { ...previous, starred: !previous.starred } } } };
}

export function moveCard(deck: FlashcardDeck, id: string, direction: -1 | 1): FlashcardDeck {
  const index = deck.cards.findIndex((card) => card.id === id), target = index + direction;
  if (index < 0 || target < 0 || target >= deck.cards.length) return deck;
  const cards = [...deck.cards];
  [cards[index], cards[target]] = [cards[target], cards[index]];
  return { ...deck, cards, updatedAt: new Date().toISOString() };
}

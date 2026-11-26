import { MAX_CARDS, MAX_SIDE_LENGTH, parseDeck, type FlashcardDeck } from "./flashcardDomain";

export const FLASHCARD_AGENT_API_VERSION = "v1" as const;
export const FLASHCARD_AGENT_LIMITS = { cards: MAX_CARDS, sideCharacters: MAX_SIDE_LENGTH, titleCharacters: 200, descriptionCharacters: 2000 } as const;
export type FlashcardAgentError = { code: "invalid_input" | "limit_exceeded"; message: string };
export type CreateDeckInput = { title: string; description?: string; color?: string; cards: Array<{ front: string; back: string }>; id?: string; timestamp?: string };

export function createFlashcardDeck(input: unknown): { ok: true; deck: FlashcardDeck; importDocument: { format: "lycium-flashcard-deck-v1"; deck: FlashcardDeck } } | { ok: false; error: FlashcardAgentError } {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, error: { code: "invalid_input", message: "A deck object is required." } };
  const request = input as Partial<CreateDeckInput>;
  if (!Array.isArray(request.cards) || request.cards.length === 0 || request.cards.length > FLASHCARD_AGENT_LIMITS.cards) return { ok: false, error: { code: "limit_exceeded", message: `Provide 1–${FLASHCARD_AGENT_LIMITS.cards} cards.` } };
  if (typeof request.title !== "string" || !request.title.trim() || request.title.length > FLASHCARD_AGENT_LIMITS.titleCharacters) return { ok: false, error: { code: "invalid_input", message: "Title must be a non-empty string of at most 200 characters." } };
  const timestamp = typeof request.timestamp === "string" && !Number.isNaN(Date.parse(request.timestamp)) ? request.timestamp : "1970-01-01T00:00:00.000Z";
  try {
    const deck = parseDeck({ id: typeof request.id === "string" && request.id.trim() ? request.id : "agent-deck", title: request.title.trim(), description: typeof request.description === "string" ? request.description : "", color: request.color, createdAt: timestamp, updatedAt: timestamp, cards: request.cards.map((card, index) => ({ id: `agent-card-${index + 1}`, front: card?.front, back: card?.back, createdAt: timestamp, updatedAt: timestamp })) });
    return { ok: true, deck, importDocument: { format: "lycium-flashcard-deck-v1", deck } };
  } catch (error) { return { ok: false, error: { code: "invalid_input", message: error instanceof Error ? error.message : "Invalid deck." } }; }
}

export function validateFlashcardDeck(value: unknown): { ok: true; deck: FlashcardDeck } | { ok: false; error: FlashcardAgentError } {
  try { return { ok: true, deck: parseDeck(value) }; } catch (error) { return { ok: false, error: { code: "invalid_input", message: error instanceof Error ? error.message : "Invalid deck." } }; }
}

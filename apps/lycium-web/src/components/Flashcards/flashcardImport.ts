import { createId, MAX_CARDS, MAX_IMPORT_BYTES, MAX_SIDE_LENGTH, parseDeck, record, type Flashcard, type FlashcardDeck } from "./flashcardDomain";

export type CardText = Pick<Flashcard, "front" | "back">;
export type ImportPreview = { title: string; description: string; color?: string; cards: CardText[]; duplicates: number };

function checkSize(text: string) {
  if (new TextEncoder().encode(text).length > MAX_IMPORT_BYTES) throw new Error("Import files must be 8 MB or smaller.");
}

export function parseDeckJson(text: string): ImportPreview {
  checkSize(text);
  const value: unknown = JSON.parse(text);
  if (!record(value) || value.format !== "lycium-flashcard-deck-v1") throw new Error("Choose a Lycium deck JSON file (lycium-flashcard-deck-v1).");
  const deck = parseDeck(value.deck);
  return { title: deck.title, description: deck.description, color: deck.color, cards: deck.cards, duplicates: duplicateCount(deck.cards) };
}

export function duplicateCount(cards: readonly CardText[]): number {
  const keys = cards.map((card) => JSON.stringify([card.front.trim(), card.back.trim()]));
  return keys.length - new Set(keys).size;
}

/** Two-column CSV/TSV with escaped quotes and multiline quoted fields. */
export function parseCardText(text: string, delimiter: "\t" | "," | ";", skipHeader = false): ImportPreview {
  checkSize(text);
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false, closed = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') { quoted = false; closed = true; }
      else field += char;
    } else if (char === '"' && !field && !closed) quoted = true;
    else if (char === delimiter || char === "\n" || char === "\r") {
      row.push(field.trim()); field = ""; closed = false;
      if (char !== delimiter) {
        if (char === "\r" && source[i + 1] === "\n") i++;
        if (row.some(Boolean)) rows.push(row);
        row = [];
      }
    } else {
      if (closed && !/\s/.test(char)) throw new Error("Unexpected text after a quoted cell.");
      field += char;
    }
  }
  if (quoted) throw new Error("A quoted cell is not closed.");
  row.push(field.trim()); if (row.some(Boolean)) rows.push(row);
  const header = rows[0]?.map((cell) => cell.toLowerCase());
  const knownHeader = header?.length === 2 && ["front", "term", "question"].includes(header[0]) && ["back", "definition", "answer"].includes(header[1]);
  const content = skipHeader || knownHeader ? rows.slice(1) : rows;
  if (!content.length || content.length > MAX_CARDS) throw new Error("Import between 1 and 5,000 cards.");
  const cards = content.map((cells, index) => {
    if (cells.length !== 2 || cells.some((cell) => !cell || cell.length > MAX_SIDE_LENGTH)) throw new Error(`Row ${index + (skipHeader || knownHeader ? 2 : 1)} needs exactly two non-empty columns. Check the separator.`);
    return { front: cells[0], back: cells[1] };
  });
  return { title: "Imported deck", description: "", cards, duplicates: duplicateCount(cards) };
}

export function cardsFromText(cards: readonly CardText[]): Flashcard[] {
  const now = new Date().toISOString();
  return cards.map((card) => ({ id: createId("card"), front: card.front.trim(), back: card.back.trim(), createdAt: now, updatedAt: now }));
}

/** Imports always create a copy, preserving existing deck IDs and learner history. */
export function deckFromPreview(preview: ImportPreview): FlashcardDeck {
  const now = new Date().toISOString();
  return { id: createId("deck"), title: preview.title || "Imported deck", description: preview.description, color: preview.color, cards: cardsFromText(preview.cards), createdAt: now, updatedAt: now };
}

export function exportDeckJson(deck: FlashcardDeck): string {
  return JSON.stringify({ format: "lycium-flashcard-deck-v1", deck }, null, 2);
}

export function exportDeckCsv(deck: FlashcardDeck): string {
  const cell = (value: string) => `"${value.replaceAll('"', '""')}"`;
  return "Front,Back\r\n" + deck.cards.map((card) => `${cell(card.front)},${cell(card.back)}`).join("\r\n");
}

export function downloadText(text: string, name: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type })), link = document.createElement("a");
  link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

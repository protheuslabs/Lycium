import { describe, expect, it } from "vitest";
import { deckFromPreview, exportDeckCsv, exportDeckJson, parseCardText, parseDeckJson } from "./flashcardImport";
import { MAX_CARDS, starterDeck } from "./flashcardDomain";

describe("flashcard portability", () => {
  it("imports 100 spreadsheet rows in one operation", () => {
    const text = Array.from({ length: 100 }, (_, i) => "Question " + i + "\tAnswer " + i).join("\n");
    expect(parseCardText(text, "\t").cards).toHaveLength(100);
  });
  it("round-trips quoted commas, newlines and equations without changing their meaning", () => {
    const deck = { ...starterDeck, cards: [{ ...starterDeck.cards[0], front: 'A "quoted", term', back: "Line 1\nLine 2" }, { ...starterDeck.cards[1], front: "=x^2", back: "-2" }] };
    expect(parseCardText(exportDeckCsv(deck), ",").cards).toEqual(deck.cards.map(({ front, back }) => ({ front, back })));
  });
  it("retains duplicate pairs and reports them explicitly", () => {
    const preview = parseCardText("a\tb\na\tb", "\t");
    expect(preview.cards).toHaveLength(2); expect(preview.duplicates).toBe(1);
  });
  it("validates JSON and creates copies without colliding with existing deck IDs", () => {
    const preview = parseDeckJson(exportDeckJson({ ...starterDeck, color: "#8060b5" }));
    const copied = deckFromPreview(preview);
    expect(copied.id).not.toBe(starterDeck.id);
    expect(copied.cards[0].id).not.toBe(starterDeck.cards[0].id);
    expect(copied.color).toBe("#8060b5");
    expect(exportDeckJson(copied)).not.toContain("reviewCount");
    expect(() => parseDeckJson('{"format":"unknown"}')).toThrow();
  });
  it("reports malformed and oversized imports", () => {
    expect(() => parseCardText('"unclosed,cell', ",")).toThrow(/closed/);
    expect(() => parseCardText("one column", ",")).toThrow(/two non-empty/);
    expect(() => parseCardText(Array(MAX_CARDS + 1).fill("a\tb").join("\n"), "\t")).toThrow(/5,000/);
  });
});

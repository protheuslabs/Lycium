import { describe, expect, it } from "vitest";
import { conceptCardFrom, replaceConceptCard } from "./ConceptCardStack";

describe("concept card stack helpers", () => {
  it("normalizes legacy string cards without changing object cards", () => {
    const objectCard = { title: "Object card", description: "Details" };

    expect(conceptCardFrom("Legacy card")).toEqual({ name: "Legacy card" });
    expect(conceptCardFrom(objectCard)).toBe(objectCard);
  });

  it("replaces one card without mutating the original collection", () => {
    const cards = ["First", { title: "Second" }, "Third"];
    const replacement = { title: "Updated" };
    const updated = replaceConceptCard(cards, 1, replacement);

    expect(updated).toEqual(["First", replacement, "Third"]);
    expect(updated).not.toBe(cards);
    expect(cards).toEqual(["First", { title: "Second" }, "Third"]);
  });
});

import { describe, expect, it } from "vitest";
import { normalizeSearchText, scoreSearchValue, scoreWeightedSearch } from "./weightedSearch";

describe("weighted search helpers", () => {
  it("normalizes user queries before scoring", () => {
    expect(normalizeSearchText("  Software Engineering  ")).toBe("software engineering");
  });

  it("scores exact, prefix, and substring matches predictably", () => {
    expect(scoreSearchValue("software", "software", 10)).toBe(40);
    expect(scoreSearchValue("software engineering", "software", 10)).toBe(30);
    expect(scoreSearchValue("intro to software engineering", "software", 10)).toBe(20);
    expect(scoreSearchValue("systems", "software", 10)).toBe(0);
  });

  it("adds weighted scores across field groups", () => {
    expect(
      scoreWeightedSearch(
        [
          { values: ["Software Engineering"], weight: 10 },
          { values: ["engineering", "systems"], weight: 4 },
        ],
        "engineering",
      ),
    ).toBe(20 + 16);
  });
});

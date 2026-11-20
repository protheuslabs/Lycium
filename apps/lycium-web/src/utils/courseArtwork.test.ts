import { describe, expect, it } from "vitest";
import { getCourseArtworkId } from "./courseArtwork";

const course = (category?: string, department?: string) => ({ data: { title: "Any title", modules: [], category, department } });

describe("course artwork", () => {
  it("uses specific subject artwork before the broad category fallback", () => {
    expect(getCourseArtworkId(course("business-management", "finance"))).toBe("finance");
    expect(getCourseArtworkId(course("social-sciences", "economics"))).toBe("finance");
    expect(getCourseArtworkId(course("natural-sciences-mathematics", "chemistry"))).toBe("chemistry");
    expect(getCourseArtworkId(course("computing-information-sciences", "mechanical-engineering"))).toBe("engineering");
    expect(getCourseArtworkId(course("natural-sciences-mathematics", "physics"))).toBe("engineering");
  });

  it("keeps software and electrical engineering on computing artwork", () => {
    expect(getCourseArtworkId(course("computing-information-sciences", "software-engineering"))).toBe("computing");
    expect(getCourseArtworkId(course("computing-information-sciences", "electrical-engineering"))).toBe("computing");
  });

  it("has stable fallbacks without inferring subject matter from the course title", () => {
    expect(getCourseArtworkId(course("arts-humanities", "history"))).toBe("humanities");
    expect(getCourseArtworkId(course())).toBe("learning");
    expect(getCourseArtworkId(course("unknown", "unknown"))).toBe("learning");
  });

  it("uses explicit subject tags when an older course only has a broad or incorrect category", () => {
    const legacy = course("computing-information-sciences", "computer-science");
    expect(getCourseArtworkId({ data: { ...legacy.data, tags: ["chemistry"] } })).toBe("chemistry");
    expect(getCourseArtworkId({ data: { ...legacy.data, tags: ["mechanical engineering"] } })).toBe("engineering");
  });
});

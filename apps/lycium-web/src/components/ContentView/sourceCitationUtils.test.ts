import { describe, expect, it } from "vitest";
import type { Section, SourceRecord } from "./contentViewTypes";
import { buildCourseSourceIndex, getSectionSources } from "./sourceCitationUtils";

const sources: SourceRecord[] = [
  { id: "source-1", type: "web", title: "First source" },
  { id: "source-2", type: "web", title: "Second source" },
];

function section(overrides: Partial<Section>): Section {
  return {
    id: "section-1",
    title: "Section",
    displayNumber: "1.1",
    pageType: "learn",
    sectionType: "lesson",
    sourceIds: [],
    content: [],
    ...overrides,
  };
}

describe("getSectionSources", () => {
  it("returns only sources referenced by the section or its blocks", () => {
    const courseSourceIndex = buildCourseSourceIndex(sources);

    expect(
      getSectionSources(
        section({
          sourceIds: ["source-2"],
          content: [{ type: "text", value: "Uses the first source.", sourceIds: ["source-1"] }],
        }),
        sources,
        courseSourceIndex,
      ).map((source) => source.id),
    ).toEqual(["source-1", "source-2"]);
  });

  it("does not return source footers for Apply sections", () => {
    const courseSourceIndex = buildCourseSourceIndex(sources);

    expect(
      getSectionSources(
        section({
          pageType: "apply",
          sectionType: "assessment",
          sourceIds: ["source-1"],
          content: [{ type: "quiz", sourceIds: ["source-2"], questions: [] }],
        }),
        sources,
        courseSourceIndex,
      ),
    ).toEqual([]);
  });
});

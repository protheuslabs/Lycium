import { describe, expect, it } from "vitest";
import type { CourseEntry, LyciumCourseSourceGap } from "../courseTypes";
import {
  sourceGapConceptCoverage,
  sourceGapMinimumUsefulSources,
  sourceGapNeededFor,
  sourceGapRecommendedTypes,
  sourceGapSummary,
} from "./courseSourceGaps";

function course(overrides: Partial<CourseEntry> = {}): CourseEntry {
  return {
    key: "source-gap-test",
    title: "Source Gap Test",
    source: "local",
    status: "needs_sources",
    data: {
      title: "Source Gap Test",
      sourceIds: ["source-1", "source-2"],
      metadata: {
        sourceGaps: [],
      },
      modules: [],
    },
    ...overrides,
  };
}

describe("course source gap helpers", () => {
  it("normalizes backend source-gap fields for display", () => {
    const gap: LyciumCourseSourceGap = {
      id: "concept-source-coverage",
      scopeType: "course",
      scopeId: "course",
      title: "Add concept sources",
      description: "Add targeted concept evidence.",
      severity: "blocking",
      minimumSourceCount: 3,
      currentSourceCount: 2,
      sourceTypeHints: ["open_textbook", "lecture_notes"],
    };

    expect(sourceGapNeededFor(gap)).toBe("Add targeted concept evidence.");
    expect(sourceGapMinimumUsefulSources(gap)).toBe(3);
    expect(sourceGapRecommendedTypes(gap)).toEqual(["open_textbook", "lecture_notes"]);
  });

  it("reports covered and uncovered concept needs", () => {
    const coverage = sourceGapConceptCoverage({
      id: "concept-source-coverage",
      scopeType: "course",
      scopeId: "course",
      title: "Add concept sources",
      description: "Add targeted concept evidence.",
      severity: "blocking",
      currentSourceCount: 2,
      conceptSourceNeeds: [
        { concept: "Thermal equilibrium", status: "direct" },
        { concept: "Crystal lattice", status: "missing" },
      ],
      sourceResumeCoverage: {
        requiredConceptCount: 2,
        coveredConceptCount: 1,
        coveragePercent: 50,
        coveredConcepts: ["Thermal equilibrium"],
        uncoveredConcepts: ["Crystal lattice"],
      },
    });

    expect(coverage.coveragePercent).toBe(50);
    expect(coverage.coveredConcepts).toEqual(["Thermal equilibrium"]);
    expect(coverage.uncoveredConcepts).toEqual(["Crystal lattice"]);
  });

  it("summarizes concept coverage across course gaps", () => {
    const summary = sourceGapSummary(
      course({
        data: {
          title: "Source Gap Test",
          sourceIds: ["source-1", "source-2"],
          metadata: {
            sourceCoveragePolicy: { minimumCourseSources: 3 },
            sourceGaps: [
              {
                id: "gap-1",
                scopeType: "course",
                scopeId: "course",
                title: "Concept gap",
                description: "Add concept sources.",
                severity: "blocking",
                currentSourceCount: 2,
                conceptSourceNeeds: [
                  { concept: "Thermal equilibrium", status: "direct" },
                  { concept: "Crystal lattice", status: "missing" },
                ],
                sourceResumeCoverage: {
                  requiredConceptCount: 2,
                  coveredConceptCount: 1,
                  coveragePercent: 50,
                  coveredConcepts: ["Thermal equilibrium"],
                  uncoveredConcepts: ["Crystal lattice"],
                },
              },
            ],
          },
          modules: [],
        },
      }),
    );

    expect(summary.currentSourceCount).toBe(2);
    expect(summary.requiredSourceCount).toBe(3);
    expect(summary.conceptCoveragePercent).toBe(50);
    expect(summary.requiredConcepts).toEqual(["Thermal equilibrium", "Crystal lattice"]);
  });
});

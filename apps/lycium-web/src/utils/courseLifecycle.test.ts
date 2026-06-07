import { describe, expect, it } from "vitest";
import type { LyciumCourseQualityReport } from "@lycium/contracts";
import type { CourseEntry } from "../courseTypes";
import { getCourseLifecycleSummary } from "./courseLifecycle";

function course(overrides: Partial<CourseEntry> = {}): CourseEntry {
  return {
    key: "course-lifecycle-test",
    title: "Lifecycle Test",
    source: "local",
    status: "draft",
    data: {
      title: "Lifecycle Test",
      modules: [],
    },
    ...overrides,
  };
}

const passingQualityReport: LyciumCourseQualityReport = {
  gate: "publish",
  passed: true,
  score: 0.95,
  errors: [],
  warnings: [],
  metrics: {},
  checkedAt: "2026-06-06T00:00:00.000Z",
  workflow: {
    workflowVersion: "test",
    status: "passed",
    checkedAt: "2026-06-06T00:00:00.000Z",
    metrics: {},
    gates: [
      {
        gate: "review_publish",
        status: "passed",
        summary: "Ready.",
        artifacts: {},
        issues: [],
      },
    ],
  },
};

describe("course lifecycle summaries", () => {
  it("routes source-gated drafts to source input", () => {
    const summary = getCourseLifecycleSummary(
      course({
        status: "needs_sources",
        data: {
          title: "Needs Sources",
          metadata: {
            sourceGaps: [
              {
                id: "gap",
                scopeType: "course",
                scopeId: "course",
                title: "More sources",
                neededFor: "Generation",
                minimumUsefulSources: 3,
                currentSourceCount: 1,
                severity: "blocking",
              },
            ],
          },
          modules: [],
        },
      }),
    );

    expect(summary.tone).toBe("source");
    expect(summary.needsSourceInput).toBe(true);
    expect(summary.canOpen).toBe(false);
  });

  it("marks passing ready-for-review courses as publishable", () => {
    const summary = getCourseLifecycleSummary(
      course({
        source: "remote",
        status: "ready_for_review",
        qualityReport: passingQualityReport,
      }),
    );

    expect(summary.tone).toBe("review");
    expect(summary.canPublish).toBe(true);
    expect(summary.isPublishCandidate).toBe(true);
  });

  it("keeps local drafts editable but not publish candidates", () => {
    const summary = getCourseLifecycleSummary(course());

    expect(summary.tone).toBe("draft");
    expect(summary.canOpen).toBe(true);
    expect(summary.canPublish).toBe(false);
    expect(summary.isPublishCandidate).toBe(false);
  });
});

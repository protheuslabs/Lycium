import { describe, expect, it } from "vitest";
import type { LyciumCourseData, LyciumCourseGenerationJob } from "@lycium/contracts";
import { generatedCourseRecordFromJob } from "./courseGenerationJobs";

const course: LyciumCourseData = {
  title: "Needs Sources Course",
  modules: [],
  metadata: {
    generationReadiness: { ready: false },
    sourceGaps: [{
      id: "gap-1",
      scopeType: "course",
      scopeId: "needs-sources-course",
      title: "Primary source coverage",
      severity: "blocking",
      currentSourceCount: 0,
      description: "Add a primary source.",
    }],
  },
};

function job(overrides: Partial<LyciumCourseGenerationJob> = {}): LyciumCourseGenerationJob {
  return {
    id: "12",
    status: "ready",
    request: { prompt: "Build a course" },
    course,
    course_snapshot: {
      id: 42,
      title: course.title,
      status: "needs_sources",
      version: 1,
    },
    trace: { generation_readiness: course.metadata?.generationReadiness },
    ...overrides,
  };
}

describe("generatedCourseRecordFromJob", () => {
  it("combines a sparse snapshot reference with the source-gated course draft", () => {
    const record = generatedCourseRecordFromJob(job());

    expect(record).toMatchObject({ id: 42, status: "needs_sources", structure: course });
    expect(record?.generation_trace).toEqual({ generation_readiness: { ready: false } });
  });

  it("prefers a full snapshot structure when the job includes one", () => {
    const snapshotCourse = { ...course, title: "Generated Snapshot" };
    const record = generatedCourseRecordFromJob(job({
      course_snapshot: {
        id: 43,
        title: snapshotCourse.title,
        status: "ready_for_review",
        structure: snapshotCourse,
      },
    }));

    expect(record?.structure).toBe(snapshotCourse);
    expect(record?.status).toBe("ready_for_review");
  });
});

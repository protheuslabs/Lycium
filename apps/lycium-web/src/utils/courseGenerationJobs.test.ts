import { describe, expect, it } from "vitest";
import type { LyciumCourseData, LyciumCourseGenerationJob } from "@lycium/contracts";
import {
  courseGenerationSpecificStatusMessage,
  courseGenerationWorkingTitle,
  generatedCourseRecordFromJob,
  isActiveCourseGenerationJob,
  recoverableCourseGenerationJobId,
} from "./courseGenerationJobs";

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

describe("course generation job recovery helpers", () => {
  it("treats queued, running, and validating jobs as recoverable active jobs", () => {
    expect(isActiveCourseGenerationJob(job({ status: "queued" }))).toBe(true);
    expect(isActiveCourseGenerationJob(job({ status: "running" }))).toBe(true);
    expect(isActiveCourseGenerationJob(job({ status: "validating" }))).toBe(true);
    expect(isActiveCourseGenerationJob(job({ status: "ready" }))).toBe(false);
    expect(isActiveCourseGenerationJob(job({ status: "failed" }))).toBe(false);
  });

  it("uses generated job titles without falling back to the prompt", () => {
    expect(courseGenerationWorkingTitle(job({ working_title: "Engineering Statics" }))).toBe("Engineering Statics");
    expect(courseGenerationWorkingTitle(job({ course: { ...course, title: "Course Title" }, working_title: null }))).toBe("Course Title");
    expect(courseGenerationWorkingTitle(job({
      course: null,
      course_snapshot: null,
      trace: { plan: { title: "Plan Title" } },
      working_title: null,
    }))).toBe("Plan Title");
    expect(courseGenerationWorkingTitle(job({
      course: null,
      course_snapshot: null,
      trace: {},
      working_title: null,
    }))).toBeNull();
  });

  it("recovers the running staged course-generation job id from generation runs", () => {
    expect(recoverableCourseGenerationJobId([
      { job_id: 8, run_type: "agent_generate_course_staged", status: "failed" },
      { job_id: 9, run_type: "other_generation", status: "running" },
      { job_id: 10, run_type: "agent_generate_course_staged", status: "running" },
    ])).toBe("10");
  });

  it("describes the module being created", () => {
    expect(courseGenerationSpecificStatusMessage(job({
      current_stage: "module_2",
      trace: {
        plan: {
          modules: [
            { title: "Module 1: Foundations of Statics" },
            { title: "Module 2: Particle Equilibrium" },
          ],
        },
      },
    }))).toBe("Creating Module 2: Particle Equilibrium");
  });

  it("describes the module section being created", () => {
    expect(courseGenerationSpecificStatusMessage(job({
      current_stage: "module_2_lesson_3",
      trace: {
        stages: [
          {
            stage: "module_2_lesson_3",
            section_title: "Three-dimensional particle equilibrium",
          },
        ],
      },
    }))).toBe("Creating Module 2 Section 3: Three-dimensional particle equilibrium");
  });

  it("uses the next planned module while sections are being planned", () => {
    expect(courseGenerationSpecificStatusMessage(job({
      current_stage: "module_section_plan_generation",
      course: {
        ...course,
        modules: [{ id: "module-1", title: "Module 1: Foundations of Statics", sections: [] }],
      },
      trace: {
        plan: {
          modules: [
            { title: "Module 1: Foundations of Statics" },
            { title: "Module 2: Particle Equilibrium" },
          ],
        },
      },
    }))).toBe("Creating Module 2: Particle Equilibrium");
  });
});

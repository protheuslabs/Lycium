import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import { validateCourseEntry, validateCourseTaxonomy } from "./course";
import type { LyciumCourseData, LyciumCourseEntry } from "./course";
import { calculateProgramProgress, validateLyciumProgram } from "./program";
import type { LyciumProgram, LyciumRequirement } from "./program";
import { migrateSourcePacketV1 } from "./sourceIndexMigrations";

function readFixture<T>(name: string): T {
  return JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), "utf8")) as T;
}

function readSchema(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(new URL(`../schemas/${name}`, import.meta.url), "utf8")) as Record<string, unknown>;
}

const ajv = new Ajv2020({ allErrors: true, strict: false });
const sourceRecordSchema = readSchema("lycium-source-record.schema.json");
ajv.addSchema(sourceRecordSchema, "lycium-source-record.schema.json");

const schemas = {
  course: readSchema("lycium-course.schema.json"),
  sourceImportBatch: readSchema("lycium-source-import-batch.schema.json"),
  sourcePacket: readSchema("lycium-source-packet.schema.json"),
  progress: readSchema("lycium-progress.schema.json"),
  quizProgress: readSchema("lycium-quiz-progress.schema.json"),
  qualityReport: readSchema("lycium-course-quality-report.schema.json"),
  lifecycle: readSchema("lycium-course-lifecycle.schema.json"),
  generationJob: readSchema("lycium-generation-job.schema.json"),
  program: readSchema("lycium-program.schema.json"),
  providerSettings: readSchema("lycium-provider-settings.schema.json"),
};

ajv.addSchema(schemas.qualityReport, "lycium-course-quality-report.schema.json");
ajv.addSchema(schemas.sourcePacket, "https://protheuslabs.github.io/Lycium/schemas/lycium-source-packet.schema.json");

describe("Lycium contract fixtures", () => {
  it("accepts a valid source-backed course with separated learn/apply sections", () => {
    const course = readFixture<LyciumCourseData>("valid-course.json");
    const validateSchema = ajv.compile(schemas.course);
    const entry: LyciumCourseEntry = {
      key: "fixture-course",
      title: course.title,
      data: course,
      source: "local",
    };

    expect(validateSchema(course), JSON.stringify(validateSchema.errors, null, 2)).toBe(true);
    expect(validateCourseEntry(entry, { requireSources: true })).toEqual({ valid: true, errors: [] });
  });

  it("validates generation readiness metadata when present", () => {
    const course = readFixture<LyciumCourseData>("valid-course.json");
    const validateSchema = ajv.compile(schemas.course);
    const readyCourse: LyciumCourseData = {
      ...course,
      metadata: {
        ...(course.metadata ?? {}),
        generationReadiness: {
          contractVersion: "course-generation-readiness-v1",
          status: "ready",
          ready: true,
          sourceEvidence: {
            sourceUrlCount: 3,
            usableInputArtifactCount: 0,
            submittedEvidenceCount: 3,
            minimumCourseSources: 3,
          },
          conceptCoverage: {
            status: "ready",
            coverageRatio: 1,
            minimumCoverageRatio: 0.8,
            requiredConceptCount: 2,
            coveredConceptCount: 2,
            uncoveredConcepts: [],
            coverageRows: [],
          },
          sourceGate: null,
          issues: [],
        },
      },
    };
    const invalidCourse = {
      ...readyCourse,
      metadata: {
        ...(readyCourse.metadata ?? {}),
        generationReadiness: {
          ...readyCourse.metadata?.generationReadiness,
          issues: [{ code: "missing_message" }],
        },
      },
    } as unknown as LyciumCourseData;

    expect(validateSchema(readyCourse), JSON.stringify(validateSchema.errors, null, 2)).toBe(true);
    expect(validateSchema(invalidCourse)).toBe(false);
    expect(validateSchema.errors?.some((error) => error.instancePath.includes("/metadata/generationReadiness/issues/0"))).toBe(true);
  });

  it("rejects courses that do not end modules with summary concept cards", () => {
    const course = readFixture<LyciumCourseData>("invalid-course-missing-summary.json");
    const entry: LyciumCourseEntry = {
      key: "fixture-invalid-summary",
      title: course.title,
      data: course,
      source: "local",
    };

    expect(validateCourseEntry(entry, { requireSources: true }).errors).toContain("module 1 must end with a summary section.");
  });

  it("rejects quiz sections that mix assessment and instructional content", () => {
    const course = readFixture<LyciumCourseData>("invalid-course-mixed-quiz-content.json");
    const entry: LyciumCourseEntry = {
      key: "fixture-invalid-mixed-quiz",
      title: course.title,
      data: course,
      source: "local",
    };

    expect(validateCourseEntry(entry, { requireSources: true }).errors).toContain(
      "module 1 section 1 mixes quiz blocks with non-quiz content.",
    );
  });

  it("rejects sourced learn pages whose concept cards are not source-supported", () => {
    const course = readFixture<LyciumCourseData>("valid-course.json");
    const brokenCourse: LyciumCourseData = {
      ...course,
      modules: course.modules.map((module, moduleIndex) =>
        moduleIndex === 0
          ? {
              ...module,
              sections: module.sections.map((section, sectionIndex) =>
                sectionIndex === 0
                  ? {
                      ...section,
                      sourceIds: [],
                      content: section.content.map((block) =>
                        block.type === "conceptCards" ? { ...block, sourceIds: [] } : block
                      ),
                    }
                  : section,
              ),
            }
          : module,
      ),
    };
    const entry: LyciumCourseEntry = {
      key: "fixture-invalid-concept-source",
      title: brokenCourse.title,
      data: brokenCourse,
      source: "local",
    };

    expect(validateCourseEntry(entry, { requireSources: true }).errors.some((error) => error.includes("concept card must include sourceIds"))).toBe(true);
  });

  it("allows explicit needs_sources drafts to remain sparse until source gaps are resolved", () => {
    const course = readFixture<LyciumCourseData>("valid-course.json");
    const draftCourse: LyciumCourseData = {
      ...course,
      sourceIds: [],
      sourceRecords: [],
      metadata: {
        ...(course.metadata ?? {}),
        status: "needs_sources",
        sourceGaps: [
          {
            id: "gap-core-concepts",
            scopeType: "course",
            scopeId: "course",
            title: "Add core concept sources",
            neededFor: "Core source coverage",
            minimumUsefulSources: 3,
            currentSourceCount: 0,
            severity: "blocking",
          },
        ],
      },
      modules: [
        {
          id: "source-gap-module",
          title: "Source coverage needed",
          sections: [
            {
              id: "source-gap-section",
              title: "Add sources to continue",
              pageType: "learn",
              sectionType: "source-gap",
              content: [{ type: "text", value: "This draft needs sources before course content can be generated." }],
            },
          ],
        },
      ],
    };
    const entry: LyciumCourseEntry = {
      key: "fixture-needs-sources",
      title: draftCourse.title,
      data: draftCourse,
      source: "local",
      status: "needs_sources",
    };

    expect(validateCourseEntry(entry, { requireSources: true })).toEqual({ valid: true, errors: [] });
  });

  it("rejects departments that are not nested under the selected category", () => {
    expect(
      validateCourseTaxonomy({
        category: "natural-sciences-mathematics",
        department: "software-engineering",
      }),
    ).toContain('Course department "software-engineering" is not in category "natural-sciences-mathematics".');
  });

  it.each([
    ["source import batch", "lycium-source-import-batch.schema.json", "valid-source-import-batch.json"],
    ["source packet", "lycium-source-packet.schema.json", "valid-source-packet.json"],
    ["progress", "lycium-progress.schema.json", "valid-progress.json"],
    ["quiz progress", "lycium-quiz-progress.schema.json", "valid-quiz-progress.json"],
    ["course quality report", "lycium-course-quality-report.schema.json", "valid-course-quality-report.json"],
    ["course lifecycle", "lycium-course-lifecycle.schema.json", "valid-course-lifecycle.json"],
    ["generation job", "lycium-generation-job.schema.json", "valid-generation-job.json"],
    ["provider settings", "lycium-provider-settings.schema.json", "valid-provider-settings.json"],
  ])("accepts valid %s fixtures", (_, schemaName, fixtureName) => {
    const schema = readSchema(schemaName);
    const schemaId = typeof schema.$id === "string" ? schema.$id : "";
    const validateSchema = ajv.getSchema(schemaName) ?? ajv.getSchema(schemaId) ?? ajv.compile(schema);
    const fixture = readFixture<unknown>(fixtureName);

    expect(validateSchema(fixture), JSON.stringify(validateSchema.errors, null, 2)).toBe(true);
  });

  it("migrates legacy source-packet fixtures by deriving packet envelope and quality evidence", () => {
    const validateSchema = ajv.compile(schemas.sourcePacket);
    const fixture = readFixture<Record<string, unknown>>("valid-source-packet.json");
    const staleFixture = { ...fixture };
    delete staleFixture.packet_id;
    delete staleFixture.generated_at;
    delete staleFixture.producer;
    delete staleFixture.quality;
    const migrated = migrateSourcePacketV1(staleFixture);

    expect(validateSchema(staleFixture)).toBe(false);
    expect(validateSchema(migrated), JSON.stringify(validateSchema.errors, null, 2)).toBe(true);
    expect(typeof migrated.packet_id).toBe("string");
    expect(typeof migrated.generated_at).toBe("string");
    expect((migrated.producer as { schema_id: string }).schema_id).toContain("lycium-source-packet");
    expect((migrated.quality as { status: string }).status).toBe("usable");
  });
});

function courseIdsFromRequirement(requirement: LyciumRequirement): string[] {
  if (requirement.type === "complete_course") return [requirement.courseId];
  if (requirement.type === "complete_n_of_courses") return requirement.courseIds;
  if (requirement.type === "requirement_set") return requirement.requirements.flatMap(courseIdsFromRequirement);
  return [];
}

describe("Lycium program contracts", () => {
  it("accepts a full-stack engineer program fixture", () => {
    const program = readFixture<LyciumProgram>("full-stack-engineer-program.json");
    const validateSchema = ajv.compile(schemas.program);
    const courseIds = program.requirementGroups.flatMap((group) => group.requirements.flatMap(courseIdsFromRequirement));
    const assessmentIds = ["assessment-backend-integration", "assessment-portfolio-review"];
    const projectIds = ["project-full-stack-capstone"];
    const competencyIds = ["competency-computer-literacy"];

    expect(validateSchema(program), JSON.stringify(validateSchema.errors, null, 2)).toBe(true);
    expect(validateLyciumProgram(program, { courseIds, assessmentIds, projectIds, competencyIds })).toEqual({ valid: true, errors: [] });
  });

  it("rejects dependency cycles", () => {
    const program = readFixture<LyciumProgram>("full-stack-engineer-program.json");
    const cyclicProgram: LyciumProgram = {
      ...program,
      dependencyGraph: {
        edges: [
          ...(program.dependencyGraph?.edges ?? []),
          { fromNodeId: "group-capstone", toNodeId: "group-foundations", type: "required" },
        ],
      },
    };

    expect(validateLyciumProgram(cyclicProgram).errors.some((error) => error.includes("contains a cycle"))).toBe(true);
  });

  it("rolls course, assessment, and project completion into program progress", () => {
    const program = readFixture<LyciumProgram>("full-stack-engineer-program.json");
    const progress = calculateProgramProgress(program, {
      viewedRequirementIds: ["req-command-line", "req-git-github", "req-capstone-project"],
      completedCourseIds: ["course-command-line", "course-git-github"],
      passedAssessmentIds: ["assessment-portfolio-review"],
      submittedProjectIds: ["project-full-stack-capstone"],
    });

    expect(progress.viewedPercent).toBeGreaterThan(0);
    expect(progress.masteryPercent).toBeGreaterThan(0);
    expect(progress.assessmentPercent).toBeGreaterThan(0);
    expect(progress.projectArtifacts).toBe(1);
  });
});

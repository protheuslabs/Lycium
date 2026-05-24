import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import { validateCourseEntry } from "./course";
import type { LyciumCourseData, LyciumCourseEntry } from "./course";

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
  progress: readSchema("lycium-progress.schema.json"),
  quizProgress: readSchema("lycium-quiz-progress.schema.json"),
  generationJob: readSchema("lycium-generation-job.schema.json"),
  providerSettings: readSchema("lycium-provider-settings.schema.json"),
};

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

  it.each([
    ["progress", "lycium-progress.schema.json", "valid-progress.json"],
    ["quiz progress", "lycium-quiz-progress.schema.json", "valid-quiz-progress.json"],
    ["generation job", "lycium-generation-job.schema.json", "valid-generation-job.json"],
    ["provider settings", "lycium-provider-settings.schema.json", "valid-provider-settings.json"],
  ])("accepts valid %s fixtures", (_, schemaName, fixtureName) => {
    const validateSchema = ajv.compile(readSchema(schemaName));
    const fixture = readFixture<unknown>(fixtureName);

    expect(validateSchema(fixture), JSON.stringify(validateSchema.errors, null, 2)).toBe(true);
  });
});

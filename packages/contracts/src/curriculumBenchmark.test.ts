import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import type { LyciumCurriculumBenchmark } from "./curriculum";
import { validateCurriculumBenchmark } from "./curriculum";

const fixture = JSON.parse(
  readFileSync(new URL("../fixtures/valid-curriculum-benchmark.json", import.meta.url), "utf8"),
) as LyciumCurriculumBenchmark;

describe("Lycium curriculum benchmark contracts", () => {
  it("accepts a benchmark with required, optional, and originated requirements", () => {
    expect(validateCurriculumBenchmark(fixture)).toEqual([]);
  });

  it("keeps the schema available as a versioned contract artifact", () => {
    const schema = JSON.parse(
      readFileSync(new URL("../schemas/lycium-curriculum-benchmark.schema.json", import.meta.url), "utf8"),
    ) as { $id?: string; title?: string };

    expect(schema.$id).toBe("https://protheuslabs.github.io/Lycium/schemas/lycium-curriculum-benchmark.schema.json");
    expect(schema.title).toBe("LyciumCurriculumBenchmark");
  });

  it("rejects unsupported source types, invalid confidence, and missing evidence", () => {
    const invalid = {
      ...fixture,
      sourceType: "blog_post",
      confidence: 2,
      extractedRequirements: [
        {
          id: "req-invalid",
          title: "Invalid origin",
          importance: "required",
          origin: {
            originType: "common_academic_requirement",
            evidenceRefs: [],
          },
        },
      ],
    } as unknown as LyciumCurriculumBenchmark;

    expect(validateCurriculumBenchmark(invalid)).toEqual(
      expect.arrayContaining([
        "Benchmark has unsupported sourceType 'blog_post'.",
        "Benchmark confidence must be between 0 and 1.",
        "Requirement 'req-invalid' origin must include evidenceRefs.",
      ]),
    );
  });
});

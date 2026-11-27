import { describe, expect, it } from "vitest";
import { validateChoice, validateNumeric } from "./interactionValidation";

describe("deterministic interaction validators", () => {
  it("uses subject-independent choice feedback", () => {
    expect(validateChoice("b", "a")).toMatchObject({ status: "incorrect", correct: false, credit: 0 });
    expect(validateChoice("a", "a")).toMatchObject({ status: "correct", correct: true, credit: 1 });
  });

  it("distinguishes significant-figure notation", () => {
    const grading = { expected: 2.5, precision: { type: "significant-figures" as const, digits: 3 } };
    expect(validateNumeric("2.5", grading).status).toBe("incorrect");
    expect(validateNumeric("2.50", grading).status).toBe("correct");
  });

  it("rejects malformed numeric input before grading", () => {
    expect(validateNumeric("2 mol", { expected: 2, precision: { type: "decimal-places", digits: 0 } }).status).toBe("invalid");
  });
});

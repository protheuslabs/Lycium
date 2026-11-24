import { describe, expect, it } from "vitest";
import { analyzeLinearDataset, validateGraphExpression } from "./graphAgent";

describe("graph agent interface", () => {
  it("validates supported explicit functions without executing user input", () => {
    expect(validateGraphExpression("y = sin(x)")).toEqual({ valid: true, expression: "sin(x)" });
    expect(validateGraphExpression("x=2")).toMatchObject({ valid: false });
  });
  it("analyzes a deterministic linear dataset", () => {
    const result = analyzeLinearDataset([{ x: "0", y: "1" }, { x: "1", y: "3" }, { x: "2", y: "5" }]);
    expect(result).toMatchObject({ slope: 2, intercept: 1 });
    if (result.ok) expect(result.rSquared).toBeCloseTo(1, 12);
  });
});

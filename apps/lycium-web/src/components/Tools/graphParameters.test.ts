import { describe, expect, it } from "vitest";
import { parameterRangeError, snapParameterValue } from "./graphParameters";

describe("parameter slider ranges", () => {
  it("supports negative ranges and fractional steps", () => {
    expect(parameterRangeError(-5, 5, 0.1)).toBeNull();
    expect(parameterRangeError(-5, -1, 0.25)).toBeNull();
  });

  it("rejects missing, nonfinite, inverted, and unusable range settings", () => {
    for (const [min, max, step] of [[NaN, 5, 1], [-5, Infinity, 1], [5, 5, 1], [5, -5, 1], [-5, 5, 0], [-5, 5, -1], [-5, 5, 11], [-1e308, 1e308, 1]]) {
      expect(parameterRangeError(min, max, step)).not.toBeNull();
    }
    expect(parameterRangeError(0, 1, 1e-320)).not.toBeNull();
  });

  it("clamps existing values and snaps them to steps when bounds change", () => {
    expect(snapParameterValue(9, -2, 2, 0.5)).toBe(2);
    expect(snapParameterValue(-9, -2, 2, 0.5)).toBe(-2);
    expect(snapParameterValue(0.32, 0, 1, 0.1)).toBe(0.3);
    expect(snapParameterValue(1, 0, 1, 0.3)).toBe(0.9);
    expect(snapParameterValue(-0.01, -1, 1, 0.1)).toBe(0);
    expect(snapParameterValue(1e15 + 0.5, 1e15, 1e15 + 1, 0.5)).toBe(1e15 + 0.5);
  });
});

describe("slider animation", () => {
  const parameter = { name: "a", min: 0, max: 2, step: 0.5, value: 1 };
  it("advances in steps and reflects at the endpoints", async () => {
    const { advanceAnimatedParameter } = await import("./graphParameters");
    expect(advanceAnimatedParameter(parameter, 2, 1).value).toBe(1.5);
    expect(advanceAnimatedParameter(parameter, 3, 2).value).toBe(1.5);
    expect(advanceAnimatedParameter(parameter, 1, -2).value).toBe(0.5);
    expect(advanceAnimatedParameter(parameter, 0, 0).value).toBe(0);
  });
});

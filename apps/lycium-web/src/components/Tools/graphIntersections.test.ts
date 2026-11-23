import { describe, expect, it } from "vitest";
import { findCrossings, findIntercepts, type Curve } from "./graphIntersections";
const line = (id: string, f: (x: number) => number): Curve => ({ id, evaluate: f, interval: (a, b) => ({ lo: Math.min(f(a), f(b)), hi: Math.max(f(a), f(b)) }) });
describe("numerical crossings", () => {
  it("finds crossings without duplicates on sample boundaries", () => {
    const results = findCrossings([line("a", x => x), line("b", x => -x)], [-10, 10]);
    expect(results).toHaveLength(1);
    expect(results[0].x).toBeCloseTo(0);
  });
  it("does not report asymptotes or overlapping curves as crossings", () => {
    const reciprocal: Curve = { id: "reciprocal", evaluate: x => 1 / x, interval: (a, b) => a <= 0 && b >= 0 ? { lo: -Infinity, hi: Infinity } : { lo: 1 / b, hi: 1 / a } };
    expect(findCrossings([reciprocal, line("zero", () => 0)], [-10, 10])).toEqual([]);
    expect(findCrossings([line("a", x => x), line("b", x => x)], [-10, 10])).toEqual([]);
  });
});

describe("intercepts", () => {
  it("finds axis crossings while rejecting an undefined y-intercept", () => {
    const reciprocal: Curve = { id: "r", evaluate: x => 1 / x, interval: (a, b) => a <= 0 && b >= 0 ? { lo: -Infinity, hi: Infinity } : { lo: 1 / b, hi: 1 / a } };
    const result = findIntercepts([line("l", x => x - 1), reciprocal], [-5, 5], [-5, 5]);
    expect(result.filter((item) => item.curve === "l")).toEqual(expect.arrayContaining([expect.objectContaining({ axis: "x", x: expect.closeTo(1, 5) }), expect.objectContaining({ axis: "y", y: -1 })]));
    expect(result.filter((item) => item.curve === "r")).toEqual([]);
  });
});

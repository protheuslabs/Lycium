import { describe, expect, it } from "vitest";
import { findCrossings, type Curve } from "./graphIntersections";
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

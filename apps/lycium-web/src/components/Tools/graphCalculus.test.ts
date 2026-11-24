import { describe, expect, it } from "vitest";
import * as plot from "function-plot";
import { tangentAt } from "./graphCalculus";
import { graphExpressionCurve } from "./graphExpressions";

const curve = (expr: string) => graphExpressionCurve({ id: "1", expr, color: "#000", visible: true }, {}, plot);

describe("tangent inspection", () => {
  it("estimates a quadratic slope", () => {
    const tangent = tangentAt(curve("x^2"), 2);
    expect(tangent.y).toBe(4);
    expect(tangent.slope).toBeCloseTo(4, 5);
  });
  it("rejects corners and domain endpoints", () => {
    expect(() => tangentAt(curve("abs(x)"), 0)).toThrow();
    expect(() => tangentAt(curve("x {0<=x<2}"), 0)).toThrow();
  });
});

import { describe, expect, it } from "vitest";
import * as plot from "function-plot";
import { tableOfValues, tangentAt } from "./graphCalculus";
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

describe("tables of values", () => {
  it("samples a function and marks undefined or restricted values", () => {
    expect(tableOfValues(curve("1/x {-1<=x<=1}"), -2, 1, 5)).toEqual([
      { x: -2, y: null }, { x: -1, y: -1 }, { x: 0, y: null }, { x: 1, y: 1 }, { x: 2, y: null },
    ]);
  });
  it("rejects invalid or excessively large requests", () => {
    expect(() => tableOfValues(curve("x"), 0, 0, 5)).toThrow();
    expect(() => tableOfValues(curve("x"), 0, 1, 101)).toThrow();
  });
});

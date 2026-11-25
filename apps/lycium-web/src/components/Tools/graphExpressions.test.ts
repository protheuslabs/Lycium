import { describe, expect, it } from "vitest";
import * as plot from "function-plot";
import { graphExpressionCurve, prepareGraphExpression, prepareGraphPieces, type GraphExpression } from "./graphExpressions";

const expression = (expr: string): GraphExpression => ({ id: "1", expr, color: "#000", visible: true });

describe("graph expression validation", () => {
  it.each(["1/x", "sqrt(x)", "1/(x-0.5)"])("accepts a function with undefined values: %s", (source) => {
    expect(() => prepareGraphExpression(expression(source), {}, plot)).not.toThrow();
  });
  it("validates parameters without requiring a React component", () => {
    const datum = prepareGraphExpression(expression("y=a*x^2+b"), { a: 2, b: 1 }, plot);
    expect(plot.EvalBuiltIn(datum, "fn", { x: 2 })).toBe(9);
    expect(() => prepareGraphExpression(expression("a*x"), {}, plot)).toThrow();
    expect(() => prepareGraphExpression(expression("a*x^2+b"), { a: 2, b: 1 }, plot)).not.toThrow();
    expect(() => prepareGraphExpression(expression("a*x^2+b"), { b: 1 }, plot)).toThrow();
  });
  it("rejects unsupported equations and invalid syntax", () => {
    expect(() => prepareGraphExpression(expression("x=3"), {}, plot)).toThrow("Only functions of x");
    expect(() => prepareGraphExpression(expression("sin("), {}, plot)).toThrow();
  });
  it("limits drawing and numerical evaluation to the specified domain", () => {
    const restricted = expression("y=x^2 {-2<=x<3}");
    expect(prepareGraphExpression(restricted, {}, plot).range).toEqual([-2, 3]);
    const curve = graphExpressionCurve(restricted, {}, plot);
    expect(curve.evaluate(-2)).toBe(4);
    expect(curve.evaluate(2)).toBe(4);
    expect(curve.evaluate(3)).toBeNaN();
    expect(curve.evaluate(-3)).toBeNaN();
    expect(curve.interval(-3, -1).lo).toBeNaN();
  });
  it("evaluates separate non-overlapping pieces", () => {
    const source = expression("x^2 {-2<=x<0}; x+1 {0<=x<=2}");
    expect(prepareGraphPieces(source, {}, plot)).toHaveLength(2);
    const curve = graphExpressionCurve(source, {}, plot);
    expect(curve.evaluate(-1)).toBe(1);
    expect(curve.evaluate(0)).toBe(1);
    expect(curve.evaluate(3)).toBeNaN();
    expect(curve.interval(-1, 1).lo).toBeNaN();
    expect(() => prepareGraphPieces(expression("x {0<=x<=2}; x {2<=x<3}"), {}, plot)).toThrow("overlap");
  });
});

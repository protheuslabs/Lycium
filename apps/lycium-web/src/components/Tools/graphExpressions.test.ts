import { describe, expect, it } from "vitest";
import * as plot from "function-plot";
import { prepareGraphExpression, type GraphExpression } from "./graphExpressions";

const expression = (expr: string): GraphExpression => ({ id: "1", expr, color: "#000", visible: true });

describe("graph expression validation", () => {
  it.each(["1/x", "sqrt(x)", "1/(x-0.5)"])("accepts a function with undefined values: %s", (source) => {
    expect(() => prepareGraphExpression(expression(source), {}, plot)).not.toThrow();
  });
  it("validates parameters without requiring a React component", () => {
    const datum = prepareGraphExpression(expression("y=a*x^2+b"), { a: 2, b: 1 }, plot);
    expect(plot.EvalBuiltIn(datum, "fn", { x: 2 })).toBe(9);
    expect(() => prepareGraphExpression(expression("a*x"), {}, plot)).toThrow();
  });
  it("rejects unsupported equations and invalid syntax", () => {
    expect(() => prepareGraphExpression(expression("x=3"), {}, plot)).toThrow("Only functions of x");
    expect(() => prepareGraphExpression(expression("sin("), {}, plot)).toThrow();
  });
});

import { describe, expect, it } from "vitest";
import { convertAsciiMathToLatex, convertLatexToAsciiMath } from "mathlive/ssr";
import { EvalBuiltIn } from "function-plot";

describe("formatted math conversion", () => {
  it.each([
    ["x^2", 2, 4],
    ["2x+1", 2, 5],
    ["sin(x)", 0, 0],
    ["1/(x-1)", 3, 0.5],
    ["sqrt(x)", 4, 2],
    ["a*x^2+b", 2, 9],
    ["(x+1)/(x^2+1)", 2, 0.6],
    ["sqrt(x+5)", 4, 3],
    ["x^(-2)", 2, 0.25],
    ["(a*x^2+b)/(x+1)", 2, 3],
  ])("retains the value of %s through the editor", (expression, x, expected) => {
    const converted = convertLatexToAsciiMath(convertAsciiMathToLatex(expression));
    const result = EvalBuiltIn({ fn: converted, scope: { a: 2, b: 1 } }, "fn", { x });
    expect(result).toBeCloseTo(expected);
  });
});

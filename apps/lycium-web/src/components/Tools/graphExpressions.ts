import type { FunctionPlotDatum } from "function-plot";

export interface GraphExpression {
  id: string;
  expr: string;
  color: string;
  visible: boolean;
}

/** Prepare an explicit function without depending on the React graph canvas. */
export function prepareGraphExpression(expression: GraphExpression, parameters: Readonly<Record<string, number>>, library: typeof import("function-plot")): FunctionPlotDatum {
  const fn = expression.expr.trim().replace(/^y\s*=\s*/i, "");
  if (fn.includes("=")) throw new Error("Only functions of x are supported. Use y= followed by an expression; equations such as x=2 are not yet supported.");
  const datum: FunctionPlotDatum = { fn, color: expression.color, scope: { ...parameters }, graphType: "interval", sampler: "interval" };
  library.EvalInterval(datum, "fn", { x: { lo: 0.5, hi: 0.5 } });
  library.EvalBuiltIn(datum, "fn", { x: 0.5 });
  return datum;
}

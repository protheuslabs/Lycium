import type { FunctionPlotDatum } from "function-plot";
import { domainContains, parseGraphDomain } from "./graphDomain";
import type { Curve } from "./graphIntersections";

export interface GraphExpression {
  id: string;
  expr: string;
  color: string;
  visible: boolean;
}

/** Prepare an explicit function without depending on the React graph canvas. */
export function prepareGraphExpression(expression: GraphExpression, parameters: Readonly<Record<string, number>>, library: typeof import("function-plot")): FunctionPlotDatum {
  const { expression: source, domain } = parseGraphDomain(expression.expr);
  const fn = source.trim().replace(/^y\s*=\s*/i, "");
  if (fn.includes("=")) throw new Error("Only functions of x are supported. Use y= followed by an expression; equations such as x=2 are not yet supported.");
  const datum: FunctionPlotDatum = { fn, color: expression.color, scope: { ...parameters }, graphType: "interval", sampler: "interval" };
  if (domain) datum.range = [domain.min, domain.max];
  library.EvalInterval(datum, "fn", { x: { lo: 0.5, hi: 0.5 } });
  library.EvalBuiltIn(datum, "fn", { x: 0.5 });
  return datum;
}

/** Semicolon-separated restricted expressions form one piecewise function. */
export function prepareGraphPieces(expression: GraphExpression, parameters: Readonly<Record<string, number>>, library: typeof import("function-plot")): { datum: FunctionPlotDatum; domain: ReturnType<typeof parseGraphDomain>["domain"] }[] {
  const sources = expression.expr.split(";");
  const pieces = sources.map((source) => {
    const parsed = parseGraphDomain(source.trim());
    if (sources.length > 1 && !parsed.domain) throw new Error("Each piece needs a domain restriction, such as x^2 {0<=x<2}.");
    return { datum: prepareGraphExpression({ ...expression, expr: source.trim() }, parameters, library), domain: parsed.domain };
  });
  for (let i = 0; i < pieces.length; i++) for (let j = i + 1; j < pieces.length; j++) {
    const a = pieces[i].domain, b = pieces[j].domain;
    if (a && b && (Math.max(a.min, b.min) < Math.min(a.max, b.max) || (a.max === b.min && a.includeMax && b.includeMin) || (b.max === a.min && b.includeMax && a.includeMin))) {
      throw new Error("Piece domains cannot overlap.");
    }
  }
  return pieces;
}

/** Apply the same domain to numerical analysis and point snapping. */
export function graphExpressionCurve(expression: GraphExpression, parameters: Readonly<Record<string, number>>, library: typeof import("function-plot")): Curve {
  const pieces = prepareGraphPieces(expression, parameters, library);
  return {
    id: expression.id,
    evaluate: (x) => {
      const piece = pieces.find(({ domain }) => domainContains(domain, x));
      return piece ? library.EvalBuiltIn(piece.datum, "fn", { x }) : NaN;
    },
    interval: (lo, hi) => {
      const piece = pieces.find(({ domain }) => domainContains(domain, lo) && domainContains(domain, hi));
      if (!piece) return { lo: NaN, hi: NaN };
      return library.EvalInterval(piece.datum, "fn", { x: { lo, hi } });
    },
  };
}

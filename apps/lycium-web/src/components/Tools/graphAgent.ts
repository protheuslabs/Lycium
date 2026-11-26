import { linearRegression, numericPoints, type DatasetRow, type GraphDataset } from "./graphDataset";
import { parseGraphDocument, type GraphDocument } from "./graphDocument";
import { areaBetweenCurves, integrateCurve, tangentAt } from "./graphCalculus";
import { findCrossings, findIntercepts, type Curve } from "./graphIntersections";
import { graphExpressionCurve, type GraphExpression } from "./graphExpressions";
import * as plot from "function-plot";

export type GraphAgentError = { code: "invalid_input" | "unsupported_expression"; message: string };
export type GraphExpressionValidation = { valid: true; expression: string } | { valid: false; error: GraphAgentError };
export const GRAPH_AGENT_API_VERSION = "v1" as const;
export const GRAPH_AGENT_LIMITS = { expressions: 20, datasets: 10, rows: 500, payloadCharacters: 12000 } as const;

export type GraphAgentOperationError = GraphAgentError & { details?: Record<string, unknown> };
export type CreateGraphInput = {
  expressions: string[] | Array<Partial<GraphExpression>>;
  datasets?: GraphDataset[];
  viewport?: GraphDocument["viewport"];
  settings?: Partial<GraphDocument["settings"]>;
};
export type GraphAnalysisOperation = "intersections" | "intercepts" | "integral" | "area" | "tangent" | "regression";

const defaultColors = ["#176b55", "#2563eb", "#c2410c", "#9333ea", "#be185d", "#0e7490"];
const documentDefaults = (expressions: GraphExpression[], datasets: GraphDataset[], viewport: GraphDocument["viewport"], settings: GraphDocument["settings"]): GraphDocument => ({
  version: 1, expressions, datasets, parameters: [], viewport,
  settings, presentation: { interactiveParameters: [] },
});

/** Encode a validated document for a small, non-secret editable URL payload. */
export function encodeGraphDocument(document: GraphDocument): string {
  const json = JSON.stringify(parseGraphDocument(document));
  const bytes = new TextEncoder().encode(json);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  const encoded = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  if (encoded.length > GRAPH_AGENT_LIMITS.payloadCharacters) throw new Error("This graph is too large to share in a URL.");
  return encoded;
}

/** Decode and validate a URL payload; malformed or oversized links fail safely. */
export function decodeGraphDocument(value: unknown): GraphDocument | null {
  if (typeof value !== "string" || value.length === 0 || value.length > GRAPH_AGENT_LIMITS.payloadCharacters) return null;
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    const binary = atob(normalized);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return parseGraphDocument(JSON.parse(new TextDecoder().decode(bytes)));
  } catch { return null; }
}

export function validateGraphExpression(expression: unknown): GraphExpressionValidation {
  if (typeof expression !== "string" || expression.trim().length === 0 || expression.length > 500) return { valid: false, error: { code: "invalid_input", message: "Expression must be a non-empty string of at most 500 characters." } };
  const normalized = expression.trim().replace(/^y\s*=\s*/i, "");
  if (normalized.includes("=") || /[^\w\s+\-*/^().,!]/.test(normalized)) return { valid: false, error: { code: "unsupported_expression", message: "Only explicit functions of x are supported." } };
  return { valid: true, expression: normalized };
}

export function createGraphDocument(input: unknown): { ok: true; document: GraphDocument } | { ok: false; error: GraphAgentError } {
  try { return { ok: true, document: parseGraphDocument(input) }; } catch (error) { return { ok: false, error: { code: "invalid_input", message: error instanceof Error ? error.message : "Invalid graph document." } }; }
}

/** Create a bounded, validated Orvane document from an agent-friendly request. */
export function createGraph(input: unknown): { ok: true; document: GraphDocument } | { ok: false; error: GraphAgentOperationError } {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, error: { code: "invalid_input", message: "create_graph requires an object with an expressions array." } };
  const request = input as Partial<CreateGraphInput>;
  if (!Array.isArray(request.expressions) || request.expressions.length === 0 || request.expressions.length > GRAPH_AGENT_LIMITS.expressions) return { ok: false, error: { code: "invalid_input", message: `Provide 1–${GRAPH_AGENT_LIMITS.expressions} expressions.` } };
  try {
    const expressions: GraphExpression[] = request.expressions.map((item, index) => {
    const value = typeof item === "string" ? item : item?.expr;
    const validation = validateGraphExpression(value);
    if (!validation.valid) throw new Error(validation.error.message);
    const color = typeof item === "object" && item?.color ? item.color : defaultColors[index % defaultColors.length];
    if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error("Expression colors must be six-digit hexadecimal values.");
    return { id: String(index + 1), expr: validation.expression, color, visible: typeof item === "object" && item?.visible === false ? false : true };
    });
    const datasets = Array.isArray(request.datasets) ? request.datasets.slice(0, GRAPH_AGENT_LIMITS.datasets) : [];
    if (Array.isArray(request.datasets) && request.datasets.length > GRAPH_AGENT_LIMITS.datasets) throw new Error(`At most ${GRAPH_AGENT_LIMITS.datasets} datasets are supported.`);
    const document = parseGraphDocument(documentDefaults(expressions, datasets, request.viewport ?? { x: [-10, 10], y: [-10, 10] }, {
      grid: request.settings?.grid ?? true, precision: request.settings?.precision ?? "auto", snapToGrid: request.settings?.snapToGrid ?? true,
    }));
    if (JSON.stringify(document).length > GRAPH_AGENT_LIMITS.payloadCharacters) throw new Error("The graph document is too large.");
    return { ok: true, document };
  } catch (error) { return { ok: false, error: { code: "invalid_input", message: error instanceof Error ? error.message : "Invalid graph request." } }; }
}

type AnalysisInput = { document?: unknown; expressions?: string[]; operation: GraphAnalysisOperation; xDomain?: [number, number]; yDomain?: [number, number]; start?: number; end?: number; x?: number; secondExpression?: string; rows?: DatasetRow[] };
const finiteBounds = (value: unknown, fallback: [number, number]): [number, number] => Array.isArray(value) && value.length === 2 && value.every((n) => typeof n === "number" && Number.isFinite(n)) && value[0] < value[1] ? [value[0], value[1]] : fallback;

/** Run deterministic numerical analysis through the same curve utilities as Orvane's UI. */
export function analyzeGraph(input: unknown): { ok: true; operation: GraphAnalysisOperation; result: unknown; limitations: string[] } | { ok: false; error: GraphAgentOperationError } {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, error: { code: "invalid_input", message: "analyze_graph requires an object." } };
  const request = input as Partial<AnalysisInput>;
  if (!["intersections", "intercepts", "integral", "area", "tangent", "regression"].includes(request.operation ?? "")) return { ok: false, error: { code: "invalid_input", message: "Unsupported analysis operation." } };
  try {
    if (request.operation === "regression") {
      if (!Array.isArray(request.rows) || request.rows.length > GRAPH_AGENT_LIMITS.rows) throw new Error("Regression requires at most 500 data rows.");
      const fit = analyzeLinearDataset(request.rows); if (!fit.ok) throw new Error(fit.error.message);
      return { ok: true, operation: request.operation, result: fit, limitations: ["Regression is ordinary least squares and numerical."] };
    }
    const source = request.document !== undefined ? createGraphDocument(request.document) : createGraph({ expressions: request.expressions ?? [] });
    if (!source.ok) throw new Error(source.error.message);
    const document = source.document;
    const curves: Curve[] = document.expressions.map((expression) => graphExpressionCurve(expression, Object.fromEntries(document.parameters.map(({ name, value }) => [name, value])), plot));
    const xDomain = finiteBounds(request.xDomain, document.viewport?.x ?? [-10, 10]);
    const yDomain = finiteBounds(request.yDomain, document.viewport?.y ?? [-10, 10]);
    const first = curves[0]; if (!first) throw new Error("At least one expression is required.");
    let result: unknown;
    if (request.operation === "intersections") result = findCrossings(curves.slice(0, 20), xDomain);
    else if (request.operation === "intercepts") result = findIntercepts(curves.slice(0, 20), xDomain, yDomain);
    else if (request.operation === "integral") result = { value: integrateCurve(first, request.start ?? xDomain[0], request.end ?? xDomain[1]) };
    else if (request.operation === "area") { if (!curves[1]) throw new Error("Area analysis requires two expressions."); result = { value: areaBetweenCurves(first, curves[1], request.start ?? xDomain[0], request.end ?? xDomain[1]) }; }
    else { if (request.operation === "tangent") result = tangentAt(first, request.x ?? 0); else throw new Error("Regression requires rows."); }
    return { ok: true, operation: request.operation, result, limitations: ["Results are numerical approximations; intersections use bounded sampling and integration uses composite Simpson quadrature."] };
  } catch (error) { return { ok: false, error: { code: "invalid_input", message: error instanceof Error ? error.message : "Analysis failed." } }; }
}


export function analyzeLinearDataset(rows: readonly DatasetRow[]): { ok: true; points: number; slope: number; intercept: number; rSquared: number } | { ok: false; error: GraphAgentError } {
  const points = numericPoints(rows); const fit = linearRegression(points);
  return fit ? { ok: true, points: points.length, ...fit } : { ok: false, error: { code: "invalid_input", message: "At least two points with distinct x values are required." } };
}

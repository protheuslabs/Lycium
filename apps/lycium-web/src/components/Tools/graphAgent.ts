import { linearRegression, numericPoints, type DatasetRow } from "./graphDataset";
import { parseGraphDocument, type GraphDocument } from "./graphDocument";

export type GraphAgentError = { code: "invalid_input" | "unsupported_expression"; message: string };
export type GraphExpressionValidation = { valid: true; expression: string } | { valid: false; error: GraphAgentError };
export const GRAPH_AGENT_API_VERSION = "v1" as const;

export function validateGraphExpression(expression: unknown): GraphExpressionValidation {
  if (typeof expression !== "string" || expression.trim().length === 0 || expression.length > 500) return { valid: false, error: { code: "invalid_input", message: "Expression must be a non-empty string of at most 500 characters." } };
  const normalized = expression.trim().replace(/^y\s*=\s*/i, "");
  if (normalized.includes("=") || /[^\w\s+\-*/^().,!]/.test(normalized)) return { valid: false, error: { code: "unsupported_expression", message: "Only explicit functions of x are supported." } };
  return { valid: true, expression: normalized };
}

export function createGraphDocument(input: unknown): { ok: true; document: GraphDocument } | { ok: false; error: GraphAgentError } {
  try { return { ok: true, document: parseGraphDocument(input) }; } catch (error) { return { ok: false, error: { code: "invalid_input", message: error instanceof Error ? error.message : "Invalid graph document." } }; }
}

export function analyzeLinearDataset(rows: readonly DatasetRow[]): { ok: true; points: number; slope: number; intercept: number; rSquared: number } | { ok: false; error: GraphAgentError } {
  const points = numericPoints(rows); const fit = linearRegression(points);
  return fit ? { ok: true, points: points.length, ...fit } : { ok: false, error: { code: "invalid_input", message: "At least two points with distinct x values are required." } };
}

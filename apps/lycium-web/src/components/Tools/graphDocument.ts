import type { GraphExpression } from "./graphExpressions";
import type { CoordinatePrecision } from "./graphCoordinates";
import { PARAMETER_NAMES, parameterRangeError, type GraphParameter } from "./graphParameters";

export interface GraphPoint { id: string; x: number; y: number; color: string; visible: boolean }

export interface GraphDocument {
  version: 1;
  expressions: GraphExpression[];
  points?: GraphPoint[];
  parameters: GraphParameter[];
  viewport: { x: [number, number]; y: [number, number] } | null;
  settings: { grid: boolean; precision: CoordinatePrecision; snapToGrid: boolean };
  presentation: { interactiveParameters: string[] };
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function domain(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length === 2 && value.every((n) => typeof n === "number" && Number.isFinite(n)) && value[0] < value[1] && Number.isFinite(value[1] - value[0]);
}

export function parseGraphDocument(value: unknown): GraphDocument {
  if (!record(value) || value.version !== 1) throw new Error("Unsupported or missing graph document version.");
  if (!Array.isArray(value.expressions) || value.expressions.length > 100) throw new Error("Expressions must be a list of at most 100 functions.");
  const ids = new Set<string>();
  const expressions = value.expressions.map((entry: unknown): GraphExpression => {
    if (!record(entry) || typeof entry.id !== "string" || !entry.id || entry.id.length > 100 || ids.has(entry.id) || typeof entry.expr !== "string" || entry.expr.length > 500 || typeof entry.color !== "string" || !/^#[0-9a-f]{6}$/i.test(entry.color) || typeof entry.visible !== "boolean") throw new Error("An expression has invalid or duplicate fields.");
    ids.add(entry.id);
    return { id: entry.id, expr: entry.expr, color: entry.color, visible: entry.visible };
  });
  const rawPoints = value.points ?? [];
  if (!Array.isArray(rawPoints) || rawPoints.length > 100) throw new Error("Points must be a list of at most 100 items.");
  const pointIds = new Set<string>();
  const points = rawPoints.map((entry: unknown): GraphPoint => {
    if (!record(entry) || typeof entry.id !== "string" || !entry.id || entry.id.length > 100 || pointIds.has(entry.id) || typeof entry.x !== "number" || !Number.isFinite(entry.x) || typeof entry.y !== "number" || !Number.isFinite(entry.y) || typeof entry.color !== "string" || !/^#[0-9a-f]{6}$/i.test(entry.color) || typeof entry.visible !== "boolean") throw new Error("A point has invalid or duplicate fields.");
    pointIds.add(entry.id);
    return { id: entry.id, x: entry.x, y: entry.y, color: entry.color, visible: entry.visible };
  });
  if (!Array.isArray(value.parameters) || value.parameters.length > PARAMETER_NAMES.length) throw new Error("Invalid parameters list.");
  const names = new Set<string>();
  const parameters = value.parameters.map((entry: unknown): GraphParameter => {
    if (!record(entry) || typeof entry.name !== "string" || !PARAMETER_NAMES.includes(entry.name) || names.has(entry.name) || typeof entry.min !== "number" || typeof entry.max !== "number" || typeof entry.step !== "number" || typeof entry.value !== "number" || !Number.isFinite(entry.value) || parameterRangeError(entry.min, entry.max, entry.step) || entry.value < entry.min || entry.value > entry.max) throw new Error("A parameter has invalid or duplicate fields.");
    names.add(entry.name);
    return { name: entry.name, value: entry.value, min: entry.min, max: entry.max, step: entry.step };
  });
  const view = value.viewport;
  if (view !== null && (!record(view) || !domain(view.x) || !domain(view.y))) throw new Error("Viewport bounds must be finite and increasing.");
  if (!record(value.settings) || typeof value.settings.grid !== "boolean" || typeof value.settings.snapToGrid !== "boolean" || !["auto", 0, 1, 2, 3, 4, 6].includes(value.settings.precision as string | number)) throw new Error("Invalid graph settings.");
  if (!record(value.presentation) || !Array.isArray(value.presentation.interactiveParameters) || !value.presentation.interactiveParameters.every((name: unknown) => typeof name === "string" && names.has(name)) || new Set(value.presentation.interactiveParameters).size !== value.presentation.interactiveParameters.length) throw new Error("Presentation controls must reference existing parameters.");
  return { version: 1, expressions, ...(value.points === undefined ? {} : { points }), parameters, viewport: view === null ? null : { x: [...(view as { x: [number, number] }).x], y: [...(view as { y: [number, number] }).y] }, settings: { grid: value.settings.grid, snapToGrid: value.settings.snapToGrid, precision: value.settings.precision as CoordinatePrecision }, presentation: { interactiveParameters: [...value.presentation.interactiveParameters] } };
}

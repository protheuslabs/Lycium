import type { GraphExpression } from "./graphExpressions";
import type { CoordinatePrecision } from "./graphCoordinates";
import { PARAMETER_NAMES, parameterRangeError, type GraphParameter } from "./graphParameters";
import type { GraphDataset } from "./graphDataset";

export interface GraphPoint { id: string; x: number; y: number; color: string; visible: boolean }
export interface GraphAnnotation { id: string; x: number; y: number; text: string }
export interface GraphLabels { title: string; xTitle: string; xUnit: string; yTitle: string; yUnit: string; annotations: GraphAnnotation[] }

export interface GraphDocument {
  version: 1;
  expressions: GraphExpression[];
  points?: GraphPoint[];
  datasets?: GraphDataset[];
  labels?: GraphLabels;
  parameters: GraphParameter[];
  rowOrder?: string[];
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
  const rawDatasets = value.datasets ?? [];
  if (!Array.isArray(rawDatasets) || rawDatasets.length > 20) throw new Error("Datasets must be a list of at most 20 tables.");
  const datasetIds = new Set<string>();
  const datasets = rawDatasets.map((entry: unknown): GraphDataset => {
    if (!record(entry) || typeof entry.id !== "string" || !entry.id || entry.id.length > 100 || datasetIds.has(entry.id) || typeof entry.name !== "string" || entry.name.length > 100 || typeof entry.xLabel !== "string" || entry.xLabel.length > 100 || typeof entry.yLabel !== "string" || entry.yLabel.length > 100 || typeof entry.color !== "string" || !/^#[0-9a-f]{6}$/i.test(entry.color) || typeof entry.visible !== "boolean" || typeof entry.regression !== "boolean" || !Array.isArray(entry.rows) || entry.rows.length > 1000) throw new Error("A dataset has invalid or duplicate fields.");
    datasetIds.add(entry.id);
    const rows = entry.rows.map((row: unknown) => {
      if (!record(row) || typeof row.x !== "string" || typeof row.y !== "string" || row.x.length > 100 || row.y.length > 100 || (row.x.trim() && !Number.isFinite(Number(row.x))) || (row.y.trim() && !Number.isFinite(Number(row.y)))) throw new Error("Dataset cells must be finite numbers or blank.");
      return { x: row.x, y: row.y };
    });
    if (entry.fitType !== undefined && entry.fitType !== "linear" && entry.fitType !== "exponential") throw new Error("Invalid regression type.");
    if (entry.connected !== undefined && typeof entry.connected !== "boolean") throw new Error("Invalid dataset display style.");
    return { id: entry.id, name: entry.name, xLabel: entry.xLabel, yLabel: entry.yLabel, color: entry.color, visible: entry.visible, regression: entry.regression, ...(entry.fitType === undefined ? {} : { fitType: entry.fitType }), ...(entry.connected === undefined ? {} : { connected: entry.connected }), rows };
  });
  let labels: GraphLabels | undefined;
  if (value.labels !== undefined) {
    const item = value.labels;
    if (!record(item) || ![item.title, item.xTitle, item.xUnit, item.yTitle, item.yUnit].every((text) => typeof text === "string" && text.length <= 100) || !Array.isArray(item.annotations) || item.annotations.length > 50) throw new Error("Invalid graph labels.");
    const ids = new Set<string>();
    const annotations = item.annotations.map((annotation: unknown): GraphAnnotation => {
      if (!record(annotation) || typeof annotation.id !== "string" || !annotation.id || annotation.id.length > 100 || ids.has(annotation.id) || typeof annotation.text !== "string" || annotation.text.length > 200 || typeof annotation.x !== "number" || !Number.isFinite(annotation.x) || typeof annotation.y !== "number" || !Number.isFinite(annotation.y)) throw new Error("Invalid graph annotation.");
      ids.add(annotation.id);
      return { id: annotation.id, text: annotation.text, x: annotation.x, y: annotation.y };
    });
    labels = { title: item.title as string, xTitle: item.xTitle as string, xUnit: item.xUnit as string, yTitle: item.yTitle as string, yUnit: item.yUnit as string, annotations };
  }
  if (!Array.isArray(value.parameters) || value.parameters.length > PARAMETER_NAMES.length) throw new Error("Invalid parameters list.");
  const names = new Set<string>();
  const parameters = value.parameters.map((entry: unknown): GraphParameter => {
    if (!record(entry) || typeof entry.name !== "string" || !PARAMETER_NAMES.includes(entry.name) || names.has(entry.name) || typeof entry.min !== "number" || typeof entry.max !== "number" || typeof entry.step !== "number" || typeof entry.value !== "number" || !Number.isFinite(entry.value) || parameterRangeError(entry.min, entry.max, entry.step) || entry.value < entry.min || entry.value > entry.max) throw new Error("A parameter has invalid or duplicate fields.");
    names.add(entry.name);
    return { name: entry.name, value: entry.value, min: entry.min, max: entry.max, step: entry.step };
  });
  const view = value.viewport;
  const rowKeys = [...expressions.map(({ id }) => `function:${id}`), ...parameters.map(({ name }) => `parameter:${name}`), ...datasets.map(({ id }) => `dataset:${id}`), ...points.map(({ id }) => `point:${id}`)];
  if (value.rowOrder !== undefined && (!Array.isArray(value.rowOrder) || value.rowOrder.some((key: unknown) => typeof key !== "string" || !rowKeys.includes(key)) || new Set(value.rowOrder).size !== value.rowOrder.length)) throw new Error("Invalid sidebar row order.");
  const rowOrder = value.rowOrder === undefined ? undefined : [...value.rowOrder as string[], ...rowKeys.filter((key) => !(value.rowOrder as string[]).includes(key))];
  if (view !== null && (!record(view) || !domain(view.x) || !domain(view.y))) throw new Error("Viewport bounds must be finite and increasing.");
  if (!record(value.settings) || typeof value.settings.grid !== "boolean" || typeof value.settings.snapToGrid !== "boolean" || !["auto", 0, 1, 2, 3, 4, 6].includes(value.settings.precision as string | number)) throw new Error("Invalid graph settings.");
  if (!record(value.presentation) || !Array.isArray(value.presentation.interactiveParameters) || !value.presentation.interactiveParameters.every((name: unknown) => typeof name === "string" && names.has(name)) || new Set(value.presentation.interactiveParameters).size !== value.presentation.interactiveParameters.length) throw new Error("Presentation controls must reference existing parameters.");
  return { version: 1, expressions, ...(value.points === undefined ? {} : { points }), ...(value.datasets === undefined ? {} : { datasets }), ...(labels ? { labels } : {}), parameters, ...(rowOrder ? { rowOrder } : {}), viewport: view === null ? null : { x: [...(view as { x: [number, number] }).x], y: [...(view as { y: [number, number] }).y] }, settings: { grid: value.settings.grid, snapToGrid: value.settings.snapToGrid, precision: value.settings.precision as CoordinatePrecision }, presentation: { interactiveParameters: [...value.presentation.interactiveParameters] } };
}

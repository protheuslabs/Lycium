"use client";

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Calculator, Cog, Download, PanelLeftClose, PanelLeftOpen, Plus, RotateCcw, Upload, X, Plus as ZoomIn, Minus as ZoomOut } from "lucide-react";
import GraphCanvas, { type GraphCanvasHandle } from "./GraphCanvas";
import type { GraphExpression } from "./graphExpressions";
import { useGraphAnalysis } from "./useGraphAnalysis";
import { parseGraphDomain } from "./graphDomain";
import ParameterSliders from "./ParameterSliders";
import DatasetPanel from "./DatasetPanel";
import GraphLabelsPanel from "./GraphLabelsPanel";
import GraphAnalysisResults from "./GraphAnalysisResults";
import OrvaneGuide from "./OrvaneGuide";
import { numericPoints, type GraphDataset } from "./graphDataset";
import MathField from "../Math/MathField";
import { PARAMETER_NAMES, type GraphParameter } from "./graphParameters";
import type { CoordinatePrecision } from "./graphCoordinates";
import { parseGraphDocument, type GraphDocument, type GraphLabels, type GraphPoint } from "./graphDocument";
import { decodeGraphDocument, encodeGraphDocument } from "./graphAgent";
import "./graphingStudio.css";

const COLORS = ["#176b55", "#2563eb", "#c2410c", "#9333ea", "#be185d", "#0e7490"];
const DEFAULT_EXPRESSIONS: GraphExpression[] = [
  { expr: "x^2", id: "1", color: COLORS[0], visible: true },
  { expr: "sin(x)", id: "2", color: COLORS[1], visible: true },
];
type FunctionAdjustment = { base: string; magnitude: number; horizontal: number; vertical: number; frequency: number };
type AdjustmentCapabilities = { horizontal: boolean; frequency: boolean };
const getAdjustmentCapabilities = (expression: string): AdjustmentCapabilities => {
  const source = expression.trim().replace(/^y\s*=\s*/i, "").replace(/\s+/g, "");
  const usesX = /\bx\b/i.test(source);
  return {
    // Transform controls are useful for every explicit x-function. Only
    // exclude them when the expression has no x input to transform.
    horizontal: usesX,
    frequency: usesX,
  };
};
const defaultAdjustment = (base: string): FunctionAdjustment => ({ base, magnitude: 1, horizontal: 0, vertical: 0, frequency: 1 });
const adjustmentExpression = ({ base, magnitude, horizontal, vertical, frequency }: FunctionAdjustment) => {
  let source = base.trim();
  let restriction = "";
  try {
    const parsed = parseGraphDomain(source);
    if (parsed.domain) { restriction = source.slice(source.indexOf("{")); source = parsed.expression; }
  } catch { return base; }
  source = source.replace(/^y\s*=\s*/i, "");
  const transformedSource = source.replace(/\bx\b/gi, `(${frequency}*(x-(${horizontal})))`);
  return `${magnitude}*(${transformedSource})+(${vertical})${restriction}`;
};

export default function GraphingStudio({ workspace = false, initialDocument }: { workspace?: boolean; initialDocument?: GraphDocument }) {
  const [headerTarget, setHeaderTarget] = useState<HTMLElement | null>(null);
  const [panelWidth, setPanelWidth] = useState(350);
  const resizeStart = useRef<{ x: number; width: number } | null>(null);
  const [loadedDocument] = useState(() => {
    if (initialDocument) return parseGraphDocument(initialDocument);
    if (typeof window !== "undefined") {
      const match = window.location.hash.match(/^#graph=([^&]+)/);
      if (match) return decodeGraphDocument(match[1]);
    }
    return null;
  });
  const [expressions, setExpressions] = useState(loadedDocument?.expressions ?? DEFAULT_EXPRESSIONS);
  const [rowOrder, setRowOrder] = useState<string[]>(() => loadedDocument?.rowOrder ?? [
    ...(loadedDocument?.expressions ?? DEFAULT_EXPRESSIONS).map(({ id }) => `function:${id}`),
    ...(loadedDocument?.parameters ?? []).map(({ name }) => `parameter:${name}`),
    ...(loadedDocument?.datasets ?? []).map(({ id }) => `dataset:${id}`),
    ...(loadedDocument?.points ?? []).map(({ id }) => `point:${id}`),
  ]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [axisBounds, setAxisBounds] = useState({ xMin: "", xMax: "", yMin: "", yMax: "" });
  const [axisError, setAxisError] = useState("");
  const [invalidDrafts, setInvalidDrafts] = useState<Record<string, boolean>>({});
  const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);
  const [adjustments, setAdjustments] = useState<Record<string, FunctionAdjustment>>({});
  const [grid, setGrid] = useState(loadedDocument?.settings.grid ?? true);
  const [precision, setPrecision] = useState<CoordinatePrecision>(loadedDocument?.settings.precision ?? "auto");
  const [snapToGrid, setSnapToGrid] = useState(loadedDocument?.settings.snapToGrid ?? true);
  const [points, setPoints] = useState<GraphPoint[]>(loadedDocument?.points ?? []);
  const [datasets, setDatasets] = useState<GraphDataset[]>(loadedDocument?.datasets ?? []);
  const [labels, setLabels] = useState<GraphLabels>(loadedDocument?.labels ?? { title: "", xTitle: "", xUnit: "", yTitle: "", yUnit: "", annotations: [] });
  const [parameters, setParameters] = useState<GraphParameter[]>(loadedDocument?.parameters ?? []);
  const draggedRow = useRef<string | null>(null);
  const dragVisual = useRef<{ row: HTMLElement; startY: number; startTop: number } | null>(null);
  const clearDragVisual = () => {
    const visual = dragVisual.current;
    if (visual) {
      visual.row.style.removeProperty("transform");
      visual.row.classList.remove("graph-row--dragging");
    }
    dragVisual.current = null;
  };
  useEffect(() => {
    const keys = [...expressions.map(({ id }) => `function:${id}`), ...parameters.map(({ name }) => `parameter:${name}`), ...datasets.map(({ id }) => `dataset:${id}`), ...points.map(({ id }) => `point:${id}`)];
    setRowOrder((previous) => {
      const next = [...previous.filter((key) => keys.includes(key)), ...keys.filter((key) => !previous.includes(key))];
      return next.length === previous.length && next.every((key, index) => key === previous[index]) ? previous : next;
    });
  }, [expressions, parameters, datasets, points]);
  const parameterValues = useMemo(() => Object.fromEntries(parameters.map(({ name, value }) => [name, value])), [parameters]);
  const [interactiveParameters, setInteractiveParameters] = useState<string[]>(loadedDocument?.presentation.interactiveParameters ?? []);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [initialViewport, setInitialViewport] = useState<GraphDocument["viewport"]>(loadedDocument?.viewport ?? null);
  const [documentRevision, setDocumentRevision] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const pointsRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDetailsElement>(null);
  const analysisRef = useRef<HTMLDetailsElement>(null);
  const helpRef = useRef<HTMLDetailsElement>(null);
  const importMenuRef = useRef<HTMLDetailsElement>(null);
  const exportMenuRef = useRef<HTMLDetailsElement>(null);
  const addMenuRef = useRef<HTMLDetailsElement>(null);
  const [expressionsVisible, setExpressionsVisible] = useState(true);
  const graphRef = useRef<GraphCanvasHandle>(null);
  const { crossings, intercepts, crossingError, tangentX, setTangentX, tangent, setTangent, tangentError, tableStart, setTableStart, tableStep, setTableStep, tableCount, setTableCount, values, tableError, integralStart, setIntegralStart, integralEnd, setIntegralEnd, areaStart, setAreaStart, areaEnd, setAreaEnd, integral, setIntegral, integralError, setIntegralError, areaSecond, setAreaSecond, area, setArea, areaError, setAreaError, areaRequest, integralRequest, areaRegion, moveAreaBound, calculateArea, calculateIntegral, generateValues, inspectTangent, findIntersections } = useGraphAnalysis({ expressions, parameters, parameterValues, selectedRowKey, errors, invalidDrafts, graphRef });
  const plottedExpressions = useMemo(() => {
    const result = expressions.map((expression) => invalidDrafts[expression.id] ? { ...expression, visible: false } : expression);
    if (tangent) result.push({ id: "__tangent__", expr: `(${tangent.slope})*(x-(${tangent.x}))+(${tangent.y})`, color: "#555555", visible: true });
    return result;
  }, [expressions, invalidDrafts, tangent]);
  const nextId = useRef(Math.max(3, ...(loadedDocument?.expressions ?? []).map(({ id }) => /^\d+$/.test(id) ? Number(id) + 1 : 3).filter(Number.isSafeInteger)));
  const id = useId();

  useEffect(() => { if (workspace) setHeaderTarget(document.getElementById("graphing-workspace-actions")); }, [workspace]);

  useEffect(() => {
    const dismissOutside = (event: PointerEvent) => {
      for (const menu of [settingsRef.current, analysisRef.current, helpRef.current, importMenuRef.current, exportMenuRef.current, addMenuRef.current]) {
        if (menu === analysisRef.current && event.target instanceof Element && event.target.closest(".graph-area-bound")) continue;
        if (menu?.open && event.target instanceof Node && !menu.contains(event.target)) menu.open = false;
      }
    };
    const dismissEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") for (const menu of [settingsRef.current, analysisRef.current, helpRef.current, importMenuRef.current, exportMenuRef.current, addMenuRef.current]) if (menu) menu.open = false;
    };
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("keydown", dismissEscape);
    return () => { document.removeEventListener("pointerdown", dismissOutside); document.removeEventListener("keydown", dismissEscape); };
  }, []);

  const updateExpression = (expressionId: string, update: Partial<GraphExpression>) => {
    setExpressions((previous) => previous.map((expression) => expression.id === expressionId ? { ...expression, ...update } : expression));
  };

  const selectExpression = (expression: GraphExpression) => {
    setSelectedRowKey(`function:${expression.id}`);
    setAdjustments((previous) => previous[expression.id] ? previous : { ...previous, [expression.id]: defaultAdjustment(expression.expr) });
  };

  const updateAdjustment = (expression: GraphExpression, update: Partial<FunctionAdjustment>) => {
    const current = adjustments[expression.id] ?? defaultAdjustment(expression.expr);
    const next = { ...current, ...update };
    setAdjustments((previous) => ({ ...previous, [expression.id]: next }));
    updateExpression(expression.id, { expr: adjustmentExpression(next) });
  };

  const addParameter = (name: string) => {
    setParameters((previous) => previous.some((parameter) => parameter.name === name) ? previous : [...previous, { name, value: 1, min: -5, max: 5, step: 0.1 }]);
  };

  const addParameters = (names: string[]) => {
    setParameters((previous) => [...previous, ...names.filter((name) => !previous.some((parameter) => parameter.name === name)).map((name) => ({ name, value: 1, min: -5, max: 5, step: 0.1 }))]);
  };

  const addFunction = () => {
    const expressionId = nextId.current++;
    setExpressions((previous) => [...previous, { id: String(expressionId), expr: "", color: COLORS[(expressionId - 1) % COLORS.length], visible: true }]);
    setRowOrder((previous) => [...previous, `function:${expressionId}`]);
    setSelectedRowKey(`function:${expressionId}`);
    addMenuRef.current?.removeAttribute("open");
  };

  const addTable = () => {
    if (datasets.length >= 20) return;
    const colors = COLORS;
    const id = crypto.randomUUID();
    setDatasets((previous) => [...previous, { id, name: `Dataset ${previous.length + 1}`, xLabel: "x", yLabel: "y", rows: [{ x: "", y: "" }, { x: "", y: "" }, { x: "", y: "" }], color: colors[(expressions.length + parameters.length + previous.length) % colors.length], visible: true, regression: false }]);
    setRowOrder((previous) => [...previous, `dataset:${id}`]);
    setSelectedRowKey(`dataset:${id}`);
    addMenuRef.current?.removeAttribute("open");
  };

  const addPoint = () => {
    const id = crypto.randomUUID();
    setPoints((previous) => [...previous, { id, x: 0, y: 0, color: COLORS[(expressions.length + parameters.length + datasets.length + previous.length) % COLORS.length], visible: true }]);
    setRowOrder((previous) => [...previous, `point:${id}`]);
    setSelectedRowKey(`point:${id}`);
    addMenuRef.current?.removeAttribute("open");
    pointsRef.current?.focus();
  };

  const addAnalysisPoint = (x: number, y: number) => {
    setPoints((previous) => [...previous, { id: crypto.randomUUID(), x, y, color: COLORS[2], visible: true }]);
    pointsRef.current?.focus();
  };

  const fitDataset = (dataset: GraphDataset, equalScale: boolean) => {
    const points = numericPoints(dataset.rows), viewport = graphRef.current?.getViewport();
    if (!points.length || !viewport) return;
    const xs = points.map(([x]) => x), ys = points.map(([, y]) => y);
    const xMin = Math.min(...xs), xMax = Math.max(...xs), yMin = Math.min(...ys), yMax = Math.max(...ys);
    const ratio = graphRef.current?.getAspectRatio() ?? (viewport.x[1] - viewport.x[0]) / (viewport.y[1] - viewport.y[0]);
    let xSpan = xMax > xMin ? (xMax - xMin) * 1.25 : Math.max(Math.abs(xMin) * 0.1, 1e-6);
    let ySpan = yMax > yMin ? (yMax - yMin) * 1.25 : Math.max(Math.abs(yMin) * 0.1, 1e-6);
    if (equalScale) { if (xSpan / ySpan < ratio) xSpan = ySpan * ratio; else ySpan = xSpan / ratio; }
    const xCenter = xMin / 2 + xMax / 2, yCenter = yMin / 2 + yMax / 2;
    graphRef.current?.setViewport({ x: [xCenter - xSpan / 2, xCenter + xSpan / 2], y: [yCenter - ySpan / 2, yCenter + ySpan / 2] });
  };

  const buildDocument = (): GraphDocument => parseGraphDocument({
    version: 1, expressions, points, datasets, labels, parameters, rowOrder, viewport: graphRef.current?.getViewport() ?? initialViewport,
    settings: { grid, precision, snapToGrid },
    presentation: { interactiveParameters: interactiveParameters.filter((name) => parameters.some((parameter) => parameter.name === name)) },
  });

  const importDocument = async (file: File) => {
    try {
      if (file.size > 1_000_000) throw new Error("Graph files must be smaller than 1 MB.");
      const document = parseGraphDocument(JSON.parse(await file.text()));
      setExpressions(document.expressions);
      setParameters(document.parameters);
      setPoints(document.points ?? []);
      setDatasets(document.datasets ?? []);
      setRowOrder(document.rowOrder ?? [...document.expressions.map(({ id }) => `function:${id}`), ...document.parameters.map(({ name }) => `parameter:${name}`), ...(document.datasets ?? []).map(({ id }) => `dataset:${id}`), ...(document.points ?? []).map(({ id }) => `point:${id}`)]);
      setLabels(document.labels ?? { title: "", xTitle: "", xUnit: "", yTitle: "", yUnit: "", annotations: [] });
      setGrid(document.settings.grid);
      setPrecision(document.settings.precision);
      setSnapToGrid(document.settings.snapToGrid);
      setInteractiveParameters(document.presentation.interactiveParameters);
      setInitialViewport(document.viewport);
      setDocumentRevision((revision) => revision + 1);
      nextId.current = Math.max(3, ...document.expressions.map(({ id }) => /^\d+$/.test(id) ? Number(id) + 1 : 3).filter(Number.isSafeInteger));
      setErrors({});
      setInvalidDrafts({});
      setDocumentError(null);
    } catch (error) {
      setDocumentError(error instanceof SyntaxError ? "This file is not valid JSON." : error instanceof Error ? error.message : "Could not load graph.");
    }
  };

  const workspaceActions = <div className="graph-workspace-actions">
    <details ref={importMenuRef} className="graph-workspace-menu"><summary className="graph-workspace-icon-button" aria-label="Import graph" title="Import graph"><Download size={17} aria-hidden="true" /></summary><div className="graph-workspace-menu-popover">
            <button type="button" onClick={() => fileRef.current?.click()}>Import JSON</button>
          </div></details>
            <input ref={fileRef} type="file" accept=".json,application/json" className="sr-only" tabIndex={-1} aria-label="Choose graph JSON" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void importDocument(file); }} />
    <details ref={exportMenuRef} className="graph-workspace-menu"><summary className="graph-workspace-icon-button" aria-label="Export graph" title="Export graph"><Upload size={17} aria-hidden="true" /></summary><div className="graph-workspace-menu-popover"><button type="button" onClick={() => {
              try {
                if (Object.values(invalidDrafts).some(Boolean)) throw new Error("Finish or discard incomplete math input before exporting.");
                const blob = new Blob([JSON.stringify(buildDocument(), null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url; link.download = "lycium-graph.json"; link.click();
                window.setTimeout(() => URL.revokeObjectURL(url), 1000);
                setDocumentError(null);
              } catch (error) { setDocumentError(error instanceof Error ? error.message : "Could not export graph."); }
            }}>Export JSON</button>
            <button type="button" onClick={async () => {
              try {
                const shareUrl = `${window.location.origin}${window.location.pathname}#graph=${encodeGraphDocument(buildDocument())}`;
                await navigator.clipboard.writeText(shareUrl);
                setDocumentError(null);
              } catch (error) { setDocumentError(error instanceof Error ? error.message : "Could not copy the share link."); }
            }}>Copy editable link</button>
            {(["svg", "png"] as const).map((format) => <button key={format} type="button" onClick={() => {
              void graphRef.current?.exportImage(format).then(() => setDocumentError(null)).catch((error: unknown) => { setDocumentError(error instanceof Error ? error.message : "Could not export image."); });
            }}>Export {format.toUpperCase()}</button>)}
          </div></details>
    <OrvaneGuide helpRef={helpRef} id={id} />
  </div>;

  return (
    <div className={`graphing-studio${workspace ? " graphing-studio--workspace" : ""}`}>
      {!workspace && <header className="graphing-heading">
        <h1>Orvane</h1>
        <p>Explore functions and compare their shapes. Drag to pan, scroll or pinch to zoom.</p>
      </header>}
      {workspace ? (headerTarget ? createPortal(workspaceActions, headerTarget) : null) : workspaceActions}
      <div className={`graphing-layout${expressionsVisible ? "" : " graphing-layout--collapsed"}`} style={{ "--graph-panel-width": `${panelWidth}px` } as CSSProperties}>
        <aside id={`${id}-expressions`} className={`graphing-expressions${expressionsVisible ? "" : " graphing-expressions--collapsed"}`} aria-hidden={!expressionsVisible} aria-labelledby={`${id}-functions`}>
          {documentError && <p className="graphing-error" role="alert">{documentError}</p>}

          <h2 id={`${id}-functions`} className="sr-only">Functions</h2>
          <div className="graphing-expression-list"
            onPointerDown={(event) => {
              if (!(event.target instanceof Element)) return;
              const strip = event.target.closest(".graphing-expression-color");
              const parameter = event.target.closest<HTMLElement>(".graphing-parameter");
              // Parameter strips are rendered with ::before, so only their
              // left edge is a drag handle; controls must keep native clicks.
              if (!strip && (!parameter || event.clientX > parameter.getBoundingClientRect().left + 26)) return;
              const row = event.target.closest<HTMLElement>(".graphing-expression-list > *");
              if (!row || !row.style.order) return;
              draggedRow.current = rowOrder[Number(row.style.order)] ?? null;
              dragVisual.current = { row, startY: event.clientY, startTop: row.offsetTop };
              row.classList.add("graph-row--dragging");
              event.currentTarget.setPointerCapture(event.pointerId);
              event.preventDefault();
            }}
            onPointerMove={(event) => {
              const visual = dragVisual.current;
              const from = draggedRow.current;
              if (!visual || !from) return;
              const position = () => {
                if (dragVisual.current === visual) visual.row.style.transform = `translateY(${event.clientY - visual.startY + visual.startTop - visual.row.offsetTop}px)`;
              };
              position();
              const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>(".graphing-expression-list > *");
              if (!target || target === visual.row || !target.style.order || target.classList.contains("graph-add-menu")) return;
              const to = rowOrder[Number(target.style.order)];
              if (!to || to === from) return;
              const bounds = target.getBoundingClientRect();
              const movingDown = rowOrder.indexOf(from) < rowOrder.indexOf(to);
              if (movingDown ? event.clientY < bounds.top + bounds.height / 2 : event.clientY > bounds.top + bounds.height / 2) return;
              setRowOrder((previous) => {
                const destination = previous.indexOf(to);
                const next = previous.filter((key) => key !== from);
                next.splice(destination, 0, from);
                return next;
              });
              requestAnimationFrame(position);
            }}
            onPointerUp={() => {
              draggedRow.current = null;
              clearDragVisual();
            }}
            onPointerCancel={() => { draggedRow.current = null; clearDragVisual(); }}
            onLostPointerCapture={() => { draggedRow.current = null; clearDragVisual(); }}
            onFocusCapture={(event) => {
              if (event.target instanceof Element && !event.target.closest(".graphing-expression, .graph-add-menu")) setSelectedRowKey(null);
            }}
            onClickCapture={(event) => {
              if (event.target instanceof Element && !event.target.closest(".graphing-expression, .graph-add-menu")) setSelectedRowKey(null);
            }}>
            {expressions.map((expression, index) => (
              <div className="graphing-expression" key={expression.id} data-hidden={!expression.visible} style={{ order: rowOrder.indexOf(`function:${expression.id}`) }}>
                <div className="graphing-expression-row">
                  <span className="graphing-expression-color" style={{ backgroundColor: expression.color }} aria-hidden="true">{rowOrder.indexOf(`function:${expression.id}`) + 1}</span>
                  <div onPointerDown={() => selectExpression(expression)} onFocus={() => selectExpression(expression)} onClick={() => selectExpression(expression)}>
                  <MathField
                    label={`Function ${index + 1}`}
                    format="ascii-math"
                    variant="graph"
                    invalid={Boolean(errors[expression.id])}
                    describedBy={errors[expression.id] ? `${id}-error-${expression.id}` : undefined}
                    value={expression.expr}
                    onChange={(value) => {
                      setAdjustments((previous) => ({ ...previous, [expression.id]: defaultAdjustment(value) }));
                      updateExpression(expression.id, { expr: value });
                    }}
                    onValidityChange={(invalid) => setInvalidDrafts((previous) => ({ ...previous, [expression.id]: invalid }))}
                  />
                  </div>
                  <button type="button" className="graphing-icon-button" aria-label={`Remove function ${index + 1}`} title="Remove function" onClick={() => { setExpressions((previous) => previous.filter(({ id: expressionId }) => expressionId !== expression.id)); setInvalidDrafts((previous) => { const next = { ...previous }; delete next[expression.id]; return next; }); }}>
                    <X size={18} aria-hidden="true" />
                  </button>
                </div>
                {selectedRowKey === `function:${expression.id}` && !expression.expr.includes(";") && (() => {
                  const adjustment = adjustments[expression.id] ?? defaultAdjustment(expression.expr);
                  const capabilities = getAdjustmentCapabilities(adjustment.base || expression.expr);
                  return <div className="graph-function-adjustments" aria-label={`Adjust function ${index + 1}`}>
                    <label>Magnitude <input type="range" min="-3" max="3" step="0.1" value={adjustment.magnitude} onChange={(event) => updateAdjustment(expression, { magnitude: Number(event.target.value) })} /><output>{adjustment.magnitude}</output></label>
                    {capabilities.frequency && <label>Frequency <input type="range" min="0.1" max="4" step="0.1" value={adjustment.frequency} onChange={(event) => updateAdjustment(expression, { frequency: Number(event.target.value) })} /><output>{adjustment.frequency}</output></label>}
                    {capabilities.horizontal && <label>Horizontal <input type="range" min="-5" max="5" step="0.1" value={adjustment.horizontal} onChange={(event) => updateAdjustment(expression, { horizontal: Number(event.target.value) })} /><output>{adjustment.horizontal}</output></label>}
                    <label>Vertical <input type="range" min="-5" max="5" step="0.1" value={adjustment.vertical} onChange={(event) => updateAdjustment(expression, { vertical: Number(event.target.value) })} /><output>{adjustment.vertical}</output></label>
                  </div>;
                })()}
                {errors[expression.id] && <p className="graphing-error" id={`${id}-error-${expression.id}`} role="status">{errors[expression.id]}</p>}
                {(() => {
                  const missing = errors[expression.id]?.match(/^symbol "([a-z])" is undefined$/)?.[1];
                  const names = [...new Set(expression.expr.match(/\b[a-z]\b/g) ?? [])].filter((name) => PARAMETER_NAMES.includes(name) && !parameters.some((parameter) => parameter.name === name));
                  return missing && PARAMETER_NAMES.includes(missing) && !parameters.some(({ name }) => name === missing)
                    ? <><button type="button" className="graphing-suggest-slider" onClick={() => addParameter(missing)}>Add slider {missing}</button>{names.length > 1 && <button type="button" className="graphing-suggest-slider" onClick={() => addParameters(names)}>Add sliders {names.join(", ")}</button>}</>
                    : null;
                })()}
              </div>
            ))}
            {expressions.length === 0 && <p className="graphing-hint">Add a function to start plotting.</p>}
            <>
            {parameters.map((parameter) => <div key={parameter.name} className="graph-sidebar-item" style={{ order: rowOrder.indexOf(`parameter:${parameter.name}`) }}><div className="graph-sidebar-item-content"><ParameterSliders key={documentRevision} parameters={[parameter]} hideAdd rowNumber={rowOrder.indexOf(`parameter:${parameter.name}`) + 1} onChange={(next) => setParameters((previous) => previous.flatMap((item) => item.name === parameter.name ? next : [item]))} /></div></div>)}
              {datasets.map((dataset) => <div key={dataset.id} className="graph-sidebar-item" style={{ order: rowOrder.indexOf(`dataset:${dataset.id}`) }}><div className="graph-sidebar-item-content"><DatasetPanel rowNumber={rowOrder.indexOf(`dataset:${dataset.id}`) + 1} datasets={[dataset]} onChange={(next) => {
                const added = next.find((item) => !datasets.some((existing) => existing.id === item.id));
                const changed = next.map((item) => ({ item, old: datasets.find((existing) => existing.id === item.id) })).find(({ item, old }) => old && (old.xLabel !== item.xLabel || old.yLabel !== item.yLabel));
                if (added || changed) setLabels((previous) => ({ ...previous,
                  xTitle: added && !previous.xTitle ? added.xLabel : changed && !previous.xUnit && previous.xTitle === changed.old?.xLabel ? changed.item.xLabel : previous.xTitle,
                  yTitle: added && !previous.yTitle ? added.yLabel : changed && !previous.yUnit && previous.yTitle === changed.old?.yLabel ? changed.item.yLabel : previous.yTitle,
                }));
                setDatasets((previous) => previous.flatMap((item) => item.id === dataset.id ? next : [item]));
              }} onFit={fitDataset} onUseLabels={(dataset) => setLabels((previous) => ({ ...previous, xTitle: dataset.xLabel, yTitle: dataset.yLabel, xUnit: "", yUnit: "" }))} onAddTable={addTable} selectedId={selectedRowKey?.startsWith("dataset:") ? selectedRowKey.slice(8) : null} onSelect={(datasetId) => setSelectedRowKey(`dataset:${datasetId}`)} /></div></div>)}
              {points.map((point, index) => <div key={point.id} className="graph-sidebar-item" style={{ order: rowOrder.indexOf(`point:${point.id}`) }}><div className="graph-sidebar-item-content"><div ref={index === 0 ? pointsRef : undefined} className="graph-points" aria-label="Points">
              <div className={`graph-point-row${selectedRowKey === `point:${point.id}` ? " graph-point-row--selected" : ""}`} onClick={() => setSelectedRowKey(`point:${point.id}`)}>
                <span className="graphing-expression-color" style={{ backgroundColor: point.color }} aria-hidden="true">{rowOrder.indexOf(`point:${point.id}`) + 1}</span>
                <label>x <input type="number" step="any" aria-label={`Point ${index + 1} x`} defaultValue={point.x} key={`${documentRevision}-${point.id}-x-${point.x}`} onBlur={(event) => { const value = event.currentTarget.valueAsNumber; if (Number.isFinite(value)) setPoints((previous) => previous.map((item) => item.id === point.id ? { ...item, x: value } : item)); else event.currentTarget.value = String(point.x); }} /></label>
                <label>y <input type="number" step="any" aria-label={`Point ${index + 1} y`} defaultValue={point.y} key={`${documentRevision}-${point.id}-y-${point.y}`} onBlur={(event) => { const value = event.currentTarget.valueAsNumber; if (Number.isFinite(value)) setPoints((previous) => previous.map((item) => item.id === point.id ? { ...item, y: value } : item)); else event.currentTarget.value = String(point.y); }} /></label>
                <button type="button" className="graphing-icon-button" aria-label={`Remove point ${index + 1}`} onClick={() => setPoints((previous) => previous.filter((item) => item.id !== point.id))}><X size={18} aria-hidden="true" /></button>
              </div>
            </div></div></div>)}
            </>
            <details ref={addMenuRef} className="graph-add-menu"><summary className="graphing-add-button" aria-label="Add graph element" title="Add graph element"><Plus size={22} strokeWidth={3} aria-hidden="true" /></summary><div className="graph-add-menu-options">
              <button type="button" onClick={addFunction}>Function</button>
              <button type="button" onClick={addTable}>Data table</button>
              <button type="button" onClick={addPoint}>Point</button>
            </div></details>
          </div>
          <div className="graph-sidebar-watermark" aria-label="Powered by Lycium"><span>powered by</span><strong>lycium</strong></div>
        </aside>
          <div className="graph-panel-resizer" role="separator" tabIndex={0} aria-label="Resize functions panel" aria-orientation="vertical" aria-controls={`${id}-expressions`} aria-valuemin={280} aria-valuemax={480} aria-valuenow={panelWidth}
            onPointerDown={(event) => { resizeStart.current = { x: event.clientX, width: event.currentTarget.previousElementSibling?.getBoundingClientRect().width ?? panelWidth }; event.currentTarget.setPointerCapture(event.pointerId); }}
            onPointerMove={(event) => { if (resizeStart.current) setPanelWidth(Math.max(280, Math.min(480, Math.round(resizeStart.current.width + event.clientX - resizeStart.current.x)))); }}
            onPointerUp={() => { resizeStart.current = null; }} onPointerCancel={() => { resizeStart.current = null; }}
            onKeyDown={(event) => { const delta = event.key === "ArrowRight" ? 10 : event.key === "ArrowLeft" ? -10 : 0; if (delta) { event.preventDefault(); setPanelWidth((width) => Math.max(280, Math.min(480, width + delta))); } }} />
        <section className="graphing-graph" aria-label="Interactive graph">
          <button type="button" className="graphing-panel-toggle graphing-panel-reopen" aria-label={expressionsVisible ? "Hide functions panel" : "Show functions panel"} title={expressionsVisible ? "Hide functions panel" : "Show functions panel"} aria-expanded={expressionsVisible} aria-controls={`${id}-expressions`} onClick={() => setExpressionsVisible((visible) => !visible)}>{expressionsVisible ? <PanelLeftClose size={18} aria-hidden="true" /> : <PanelLeftOpen size={18} aria-hidden="true" />}</button>
            <div className="graphing-graph-controls">
<details ref={analysisRef} className="graph-analysis-menu"><summary aria-label="Graph analysis" title="Graph analysis"><Calculator size={19} aria-hidden="true" /></summary><div className="graph-analysis-popover">
              <h2>Analysis</h2>
              <details><summary>Area between curves</summary>
                <p>Select the first function in the sidebar.</p>
                <label>Second function <select value={areaSecond} onChange={(event) => setAreaSecond(event.target.value)}><option value="">Choose a function</option>{expressions.map((expression, index) => <option key={expression.id} value={expression.id}>Function {index + 1}</option>)}</select></label>
                <label>From x <input type="number" step="any" value={areaStart} onChange={(event) => { areaRequest.current++; setAreaStart(event.target.value); setArea(null); setAreaError(""); }} /></label>
                <label>To x <input type="number" step="any" value={areaEnd} onChange={(event) => { areaRequest.current++; setAreaEnd(event.target.value); setArea(null); setAreaError(""); }} /></label>
                <button type="button" onClick={() => void calculateArea()}>Calculate area</button>
                {areaError && <p className="graphing-error" role="alert">{areaError}</p>}
                {area !== null && !areaError && <p role="status">Approximate area: {Number(area.toPrecision(4))}</p>}
              </details>
              <details><summary>Signed integral</summary>
                <label>From x <input type="number" step="any" value={integralStart} onChange={(event) => { integralRequest.current++; setIntegralStart(event.target.value); setIntegral(null); setIntegralError(""); }} /></label>
                <label>To x <input type="number" step="any" value={integralEnd} onChange={(event) => { integralRequest.current++; setIntegralEnd(event.target.value); setIntegral(null); setIntegralError(""); }} /></label>
                <button type="button" onClick={() => void calculateIntegral()}>Calculate for selected function</button>
                {integralError && <p className="graphing-error" role="alert">{integralError}</p>}
                {integral !== null && <p role="status">Approximate signed integral: {Number(integral.toPrecision(4))}</p>}
              </details>
              <details><summary>Table of values</summary>
                <label>Start x <input type="number" step="any" value={tableStart} onChange={(event) => setTableStart(event.target.value)} /></label>
                <label>Step <input type="number" step="any" value={tableStep} onChange={(event) => setTableStep(event.target.value)} /></label>
                <label>Rows <input type="number" min="1" max="100" step="1" value={tableCount} onChange={(event) => setTableCount(event.target.value)} /></label>
                <button type="button" onClick={() => void generateValues()}>Generate for selected function</button>
                {tableError && <p className="graphing-error" role="alert">{tableError}</p>}
                {values && <table><thead><tr><th scope="col">x</th><th scope="col">y</th></tr></thead><tbody>{values.map(({ x, y }, index) => <tr key={index}><td>{Number(x.toPrecision(8))}</td><td>{y === null ? "Undefined" : Number(y.toPrecision(8))}</td></tr>)}</tbody></table>}
              </details>
              <details><summary>Tangent and slope</summary>
              <label>Tangent at x <input type="number" step="any" value={tangentX} onChange={(event) => setTangentX(event.target.value)} /></label>
              <button type="button" className="graphing-add-button graph-find-intersections" onClick={() => void inspectTangent()}>Show tangent for selected function</button>
              {tangentError && <p className="graphing-error" role="alert">{tangentError}</p>}
              {tangent && <p role="status">Point ({Number(tangent.x.toPrecision(6))}, {Number(tangent.y.toPrecision(6))}) · slope {Number(tangent.slope.toPrecision(6))} <button type="button" onClick={() => setTangent(null)}>Clear</button></p>}
              </details>
              <details><summary>Intersections and intercepts</summary>
              <button type="button" className="graphing-add-button graph-find-intersections" onClick={() => void findIntersections("crossings")}>Find intersections</button>
              <button type="button" className="graphing-add-button graph-find-intersections" onClick={() => void findIntersections("intercepts")}>Find intercepts</button>
              <p className="graphing-hint">Approximate crossings in the current view. Tangencies and some intersections may be missed. Search again after moving the view.</p>
              {crossingError && <p className="graphing-error" role="alert">{crossingError}</p>}
              <GraphAnalysisResults expressions={expressions} crossings={crossings} intercepts={intercepts} onAddPoint={addAnalysisPoint} />
              </details>
            </div></details>
            <div className="graphing-view-controls">
              <button type="button" className="graphing-icon-button" aria-label="Zoom in" title="Zoom in" onClick={() => graphRef.current?.zoom(0.8)}><ZoomIn size={19} aria-hidden="true" /></button>
              <button type="button" className="graphing-icon-button" aria-label="Zoom out" title="Zoom out" onClick={() => graphRef.current?.zoom(1.25)}><ZoomOut size={19} aria-hidden="true" /></button>
              <button type="button" className="graphing-icon-button" aria-label="Reset view" title="Reset view" onClick={() => graphRef.current?.reset()}><RotateCcw size={18} aria-hidden="true" /></button>
            </div>
          <details ref={settingsRef} className="graph-settings"><summary aria-label="Graph settings" title="Graph settings"><Cog size={17} aria-hidden="true" /></summary><div className="graphing-trace-controls" role="group" aria-label="Coordinate readout settings">
            <label className="graphing-grid-toggle"><input type="checkbox" checked={grid} onChange={(event) => setGrid(event.target.checked)} />Grid</label>

            <label>Decimals
              <select aria-label="Coordinate precision" value={precision} onChange={(event) => {
                const value = event.target.value;
                if (value === "auto") setPrecision("auto");
                else if (value === "0" || value === "1" || value === "2" || value === "3" || value === "4" || value === "6") setPrecision(Number(value) as CoordinatePrecision);
              }}>
                <option value="auto">Auto</option>
                {[0, 1, 2, 3, 4, 6].map((digits) => <option key={digits} value={digits}>{digits}</option>)}
              </select>
            </label>
            <label title="Snap x to visible grid increments; y is calculated from the function."><input type="checkbox" checked={snapToGrid} onChange={(event) => setSnapToGrid(event.target.checked)} />Snap x to grid</label>
          <details className="graph-axis-settings" onToggle={(event) => {
            if (!event.currentTarget.open) return;
            const viewport = graphRef.current?.getViewport();
            if (viewport) setAxisBounds({ xMin: String(viewport.x[0]), xMax: String(viewport.x[1]), yMin: String(viewport.y[0]), yMax: String(viewport.y[1]) });
            setAxisError("");
          }}>
            <summary>Axis bounds</summary>
            <form onSubmit={(event) => {
              event.preventDefault();
              const values = [axisBounds.xMin, axisBounds.xMax, axisBounds.yMin, axisBounds.yMax].map((value) => value.trim() ? Number(value) : NaN);
              if (!values.every(Number.isFinite) || values[0] >= values[1] || values[2] >= values[3] || !Number.isFinite(values[1] - values[0]) || !Number.isFinite(values[3] - values[2])) { setAxisError("Enter finite, increasing minimum and maximum values for both axes."); return; }
              graphRef.current?.setViewport({ x: [values[0], values[1]], y: [values[2], values[3]] });
              setAxisError("");
            }}>
              <div className="graph-axis-fields">{(["xMin", "xMax", "yMin", "yMax"] as const).map((key) => <label key={key}>{key[0]} {key.endsWith("Min") ? "min" : "max"}<input type="number" step="any" aria-label={`${key[0].toUpperCase()} ${key.endsWith("Min") ? "minimum" : "maximum"}`} value={axisBounds[key]} onChange={(event) => setAxisBounds((previous) => ({ ...previous, [key]: event.target.value }))} /></label>)}</div>
              {axisError && <p className="graphing-error" role="alert">{axisError}</p>}
              <button type="submit">Apply bounds</button>
            </form>
          </details>
          <GraphLabelsPanel labels={labels} onChange={setLabels} />
          </div></details>
          </div>
          <GraphCanvas key={documentRevision} ref={graphRef} initialViewport={initialViewport} expressions={plottedExpressions} selectedExpressionId={selectedRowKey?.startsWith("function:") ? selectedRowKey.slice(9) : null} points={points} datasets={datasets} labels={labels} parameters={parameterValues} grid={grid} precision={precision} snapToGrid={snapToGrid} areaRegion={areaRegion} onAreaBoundMove={moveAreaBound} onErrors={setErrors} onPointMove={(pointId, x, y) => setPoints((previous) => previous.map((point) => point.id === pointId ? { ...point, x, y } : point))} />
        </section>
      </div>
    </div>
  );
}

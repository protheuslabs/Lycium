"use client";

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Eye, EyeOff, PanelLeftClose, PanelLeftOpen, Plus, RotateCcw, Trash2, ZoomIn, ZoomOut } from "lucide-react";
import GraphCanvas, { type GraphCanvasHandle } from "./GraphCanvas";
import type { GraphExpression } from "./graphExpressions";
import ParameterSliders from "./ParameterSliders";
import DatasetPanel from "./DatasetPanel";
import { numericPoints, type GraphDataset } from "./graphDataset";
import MathExpressionField from "./MathExpressionField";
import { PARAMETER_NAMES, type GraphParameter } from "./graphParameters";
import type { CoordinatePrecision } from "./graphCoordinates";
import { parseGraphDocument, type GraphDocument, type GraphPoint } from "./graphDocument";
import { findCrossings, findIntercepts, type Curve, type Intercept, type Intersection } from "./graphIntersections";
import "./graphingStudio.css";

const COLORS = ["#176b55", "#2563eb", "#c2410c", "#9333ea", "#be185d", "#0e7490"];
const DEFAULT_EXPRESSIONS: GraphExpression[] = [
  { expr: "x^2", id: "1", color: COLORS[0], visible: true },
  { expr: "sin(x)", id: "2", color: COLORS[1], visible: true },
];

export default function GraphingStudio({ workspace = false, initialDocument, initialMode = "editor", allowEditing = true }: { workspace?: boolean; initialDocument?: GraphDocument; initialMode?: "editor" | "presentation"; allowEditing?: boolean }) {
  const [headerTarget, setHeaderTarget] = useState<HTMLElement | null>(null);
  const [panelWidth, setPanelWidth] = useState(350);
  const resizeStart = useRef<{ x: number; width: number } | null>(null);
  const [loadedDocument] = useState(() => initialDocument ? parseGraphDocument(initialDocument) : null);
  const [expressions, setExpressions] = useState(loadedDocument?.expressions ?? DEFAULT_EXPRESSIONS);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [crossings, setCrossings] = useState<Intersection[] | null>(null);
  const [intercepts, setIntercepts] = useState<Intercept[] | null>(null);
  const [crossingError, setCrossingError] = useState("");
  const [axisBounds, setAxisBounds] = useState({ xMin: "", xMax: "", yMin: "", yMax: "" });
  const [axisError, setAxisError] = useState("");
  const [invalidDrafts, setInvalidDrafts] = useState<Record<string, boolean>>({});
  const plottedExpressions = useMemo(() => expressions.map((expression) => invalidDrafts[expression.id] ? { ...expression, visible: false } : expression), [expressions, invalidDrafts]);
  const [grid, setGrid] = useState(loadedDocument?.settings.grid ?? true);
  const [precision, setPrecision] = useState<CoordinatePrecision>(loadedDocument?.settings.precision ?? "auto");
  const [snapToGrid, setSnapToGrid] = useState(loadedDocument?.settings.snapToGrid ?? false);
  const [points, setPoints] = useState<GraphPoint[]>(loadedDocument?.points ?? []);
  const [datasets, setDatasets] = useState<GraphDataset[]>(loadedDocument?.datasets ?? []);
  const [parameters, setParameters] = useState<GraphParameter[]>(loadedDocument?.parameters ?? []);
  const parameterValues = useMemo(() => Object.fromEntries(parameters.map(({ name, value }) => [name, value])), [parameters]);
  const [mode, setMode] = useState<"editor" | "presentation">(allowEditing ? initialMode : "presentation");
  const [interactiveParameters, setInteractiveParameters] = useState<string[]>(loadedDocument?.presentation.interactiveParameters ?? []);
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [documentNotice, setDocumentNotice] = useState("");
  const [initialViewport, setInitialViewport] = useState<GraphDocument["viewport"]>(loadedDocument?.viewport ?? null);
  const [documentRevision, setDocumentRevision] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const pointsRef = useRef<HTMLDetailsElement>(null);
  const settingsRef = useRef<HTMLDetailsElement>(null);
  const fileMenuRef = useRef<HTMLDetailsElement>(null);
  const [expressionsVisible, setExpressionsVisible] = useState(true);
  const graphRef = useRef<GraphCanvasHandle>(null);
  const nextId = useRef(Math.max(3, ...(loadedDocument?.expressions ?? []).map(({ id }) => /^\d+$/.test(id) ? Number(id) + 1 : 3).filter(Number.isSafeInteger)));
  const id = useId();

  useEffect(() => { if (workspace) setHeaderTarget(document.getElementById("graphing-workspace-actions")); }, [workspace]);

  useEffect(() => {
    const dismissOutside = (event: PointerEvent) => {
      for (const menu of [settingsRef.current, fileMenuRef.current]) {
        if (menu?.open && event.target instanceof Node && !menu.contains(event.target)) menu.open = false;
      }
    };
    const dismissEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") for (const menu of [settingsRef.current, fileMenuRef.current]) if (menu) menu.open = false;
    };
    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("keydown", dismissEscape);
    return () => { document.removeEventListener("pointerdown", dismissOutside); document.removeEventListener("keydown", dismissEscape); };
  }, []);

  useEffect(() => { setCrossings(null); setIntercepts(null); setCrossingError(""); }, [expressions, parameters]);

  const findIntersections = async (kind: "crossings" | "intercepts") => {
    const viewport = graphRef.current?.getViewport();
    const active = expressions.filter((expression) => expression.visible && expression.expr.trim() && !errors[expression.id] && !invalidDrafts[expression.id]);
    if (!viewport) { setCrossingError("The graph is still loading."); return; }
    if (active.length < (kind === "crossings" ? 2 : 1)) { setCrossingError(kind === "crossings" ? "Show at least two valid functions to find crossings." : "Show at least one valid function to find intercepts."); return; }
    if (active.length > 8) { setCrossingError("Show no more than eight functions at a time to find crossings."); return; }
    try {
      const library = await import("function-plot");
      const curves: Curve[] = active.map((expression) => {
        const datum = { fn: expression.expr.trim().replace(/^y\s*=\s*/i, ""), scope: { ...parameterValues } };
        return { id: expression.id, evaluate: (x) => library.EvalBuiltIn(datum, "fn", { x }), interval: (lo, hi) => library.EvalInterval(datum, "fn", { x: { lo, hi } }) };
      });
      if (kind === "crossings") {
        setCrossings(findCrossings(curves, viewport.x).filter(({ y }) => y >= viewport.y[0] && y <= viewport.y[1]));
        setIntercepts(null);
      } else {
        setIntercepts(findIntercepts(curves, viewport.x, viewport.y));
        setCrossings(null);
      }
      setCrossingError("");
    } catch { setCrossingError("Could not calculate intersections for these functions."); }
  };

  const updateExpression = (expressionId: string, update: Partial<GraphExpression>) => {
    setExpressions((previous) => previous.map((expression) => expression.id === expressionId ? { ...expression, ...update } : expression));
  };

  const addParameter = (name: string) => {
    setParameters((previous) => previous.some((parameter) => parameter.name === name) ? previous : [...previous, { name, value: 1, min: -5, max: 5, step: 0.1 }]);
  };

  const addParameters = (names: string[]) => {
    setParameters((previous) => [...previous, ...names.filter((name) => !previous.some((parameter) => parameter.name === name)).map((name) => ({ name, value: 1, min: -5, max: 5, step: 0.1 }))]);
  };

  const addAnalysisPoint = (x: number, y: number) => {
    setPoints((previous) => [...previous, { id: crypto.randomUUID(), x, y, color: COLORS[2], visible: true }]);
    if (pointsRef.current) pointsRef.current.open = true;
  };

  const fitDataset = (dataset: GraphDataset) => {
    const points = numericPoints(dataset.rows), viewport = graphRef.current?.getViewport();
    if (!points.length || !viewport) return;
    const xs = points.map(([x]) => x), ys = points.map(([, y]) => y);
    const xMin = Math.min(...xs), xMax = Math.max(...xs), yMin = Math.min(...ys), yMax = Math.max(...ys);
    const ratio = (viewport.x[1] - viewport.x[0]) / (viewport.y[1] - viewport.y[0]);
    let xSpan = Math.max((xMax - xMin) * 1.25, 1), ySpan = Math.max((yMax - yMin) * 1.25, 1);
    if (xSpan / ySpan < ratio) xSpan = ySpan * ratio; else ySpan = xSpan / ratio;
    const xCenter = xMin / 2 + xMax / 2, yCenter = yMin / 2 + yMax / 2;
    graphRef.current?.setViewport({ x: [xCenter - xSpan / 2, xCenter + xSpan / 2], y: [yCenter - ySpan / 2, yCenter + ySpan / 2] });
  };

  const buildDocument = (): GraphDocument => parseGraphDocument({
    version: 1, expressions, points, datasets, parameters, viewport: graphRef.current?.getViewport() ?? initialViewport,
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
      setGrid(document.settings.grid);
      setPrecision(document.settings.precision);
      setSnapToGrid(document.settings.snapToGrid);
      setInteractiveParameters(document.presentation.interactiveParameters);
      setInitialViewport(document.viewport);
      setDocumentRevision((revision) => revision + 1);
      nextId.current = Math.max(3, ...document.expressions.map(({ id }) => /^\d+$/.test(id) ? Number(id) + 1 : 3).filter(Number.isSafeInteger));
      setErrors({});
      setInvalidDrafts({});
      setMode("editor");
      setDocumentError(null);
      setDocumentNotice("Graph loaded.");
    } catch (error) {
      setDocumentNotice("");
      setDocumentError(error instanceof SyntaxError ? "This file is not valid JSON." : error instanceof Error ? error.message : "Could not load graph.");
    }
  };

  const workspaceActions = <div className="graph-workspace-actions">
    <details ref={fileMenuRef} className="graph-file-menu"><summary>File / Export</summary><div className="graph-file-popover">
{allowEditing && <>
            <button type="button" onClick={() => fileRef.current?.click()}>Import JSON</button>
            <input ref={fileRef} type="file" accept=".json,application/json" className="sr-only" tabIndex={-1} aria-label="Choose graph JSON" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void importDocument(file); }} />
            <button type="button" onClick={() => {
              try {
                if (Object.values(invalidDrafts).some(Boolean)) throw new Error("Finish or discard incomplete math input before exporting.");
                const blob = new Blob([JSON.stringify(buildDocument(), null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url; link.download = "lycium-graph.json"; link.click();
                window.setTimeout(() => URL.revokeObjectURL(url), 1000);
                setDocumentError(null); setDocumentNotice("Graph exported.");
              } catch (error) { setDocumentError(error instanceof Error ? error.message : "Could not export graph."); }
            }}>Export JSON</button>
          </>}
          <>
            {(["svg", "png"] as const).map((format) => <button key={format} type="button" onClick={() => {
              void graphRef.current?.exportImage(format).then(() => { setDocumentError(""); setDocumentNotice(`Graph exported as ${format.toUpperCase()}.`); }).catch((error: unknown) => { setDocumentNotice(""); setDocumentError(error instanceof Error ? error.message : "Could not export image."); });
            }}>Export {format.toUpperCase()}</button>)}
          </>
    </div></details>
    {allowEditing && <button type="button" className="graph-present-button" disabled={mode === "editor" && Object.values(invalidDrafts).some(Boolean)} onClick={() => setMode((current) => current === "editor" ? "presentation" : "editor")}>{mode === "editor" ? "Present" : "Edit graph"}</button>}
  </div>;

  return (
    <div className={`graphing-studio${workspace ? " graphing-studio--workspace" : ""}`}>
      {!workspace && <header className="graphing-heading">
        <h1>Graphing Studio</h1>
        <p>Explore functions and compare their shapes. Drag to pan, scroll or pinch to zoom.</p>
      </header>}
      {workspace && headerTarget ? createPortal(workspaceActions, headerTarget) : workspaceActions}
      <div className={`graphing-layout${expressionsVisible ? "" : " graphing-layout--collapsed"}`} style={{ "--graph-panel-width": `${panelWidth}px` } as CSSProperties}>
        <aside id={`${id}-expressions`} hidden={!expressionsVisible} className="graphing-expressions" aria-labelledby={`${id}-functions`}>
          {documentError && <p className="graphing-error" role="alert">{documentError}</p>}
          {documentNotice && <p className="graphing-hint" role="status">{documentNotice}</p>}

          <h2 id={`${id}-functions`}>{mode === "editor" ? "Functions" : "Presentation controls"}</h2>
          {mode === "editor" && <p className="graphing-hint">Use x^2, sin(x), 2*x+1, or y=1/x. Angles are in radians.</p>}
          <div className="graphing-expression-list">
            {mode === "editor" && expressions.map((expression, index) => (
              <div className="graphing-expression" key={expression.id} data-hidden={!expression.visible}>
                <div className="graphing-expression-row">
                  <span className="graphing-expression-number" aria-hidden="true">{index + 1}</span>
                  <span className="graphing-color" style={{ backgroundColor: expression.color }} aria-hidden="true" />
                  <MathExpressionField
                    label={`Function ${index + 1}`}
                    invalid={Boolean(errors[expression.id])}
                    describedBy={errors[expression.id] ? `${id}-error-${expression.id}` : undefined}
                    value={expression.expr}
                    onChange={(value) => updateExpression(expression.id, { expr: value })}
                    onDraftError={(invalid) => setInvalidDrafts((previous) => ({ ...previous, [expression.id]: invalid }))}
                  />
                  <button type="button" className="graphing-icon-button" aria-label={`${expression.visible ? "Hide" : "Show"} function ${index + 1}`} aria-pressed={expression.visible} title={expression.visible ? "Hide function" : "Show function"} onClick={() => updateExpression(expression.id, { visible: !expression.visible })}>
                    {expression.visible ? <Eye size={18} aria-hidden="true" /> : <EyeOff size={18} aria-hidden="true" />}
                  </button>
                  <button type="button" className="graphing-icon-button" aria-label={`Remove function ${index + 1}`} title="Remove function" onClick={() => { setExpressions((previous) => previous.filter(({ id: expressionId }) => expressionId !== expression.id)); setInvalidDrafts((previous) => { const next = { ...previous }; delete next[expression.id]; return next; }); }}>
                    <Trash2 size={18} aria-hidden="true" />
                  </button>
                </div>
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
            {mode === "editor" && <button type="button" className="graphing-add-button" onClick={() => {
              const expressionId = nextId.current++;
              setExpressions((previous) => [...previous, { id: String(expressionId), expr: "", color: COLORS[(expressionId - 1) % COLORS.length], visible: true }]);
            }}><Plus size={18} aria-hidden="true" />Add function</button>}
            {mode === "editor" && expressions.length === 0 && <p className="graphing-hint">Add a function to start plotting.</p>}
            {mode === "editor" ? <>
            <ParameterSliders key={documentRevision} parameters={parameters} onChange={setParameters} />
              <DatasetPanel datasets={datasets} onChange={setDatasets} onFit={fitDataset} />
              <details ref={pointsRef} className="graph-points" aria-label="Points"><summary>Points</summary>
              {points.map((point, index) => <div className="graph-point-row" key={point.id}>
                <span className="graphing-color" style={{ backgroundColor: point.color }} aria-hidden="true" />
                <label>x <input type="number" step="any" aria-label={`Point ${index + 1} x`} defaultValue={point.x} key={`${documentRevision}-${point.id}-x-${point.x}`} onBlur={(event) => { const value = event.currentTarget.valueAsNumber; if (Number.isFinite(value)) setPoints((previous) => previous.map((item) => item.id === point.id ? { ...item, x: value } : item)); else event.currentTarget.value = String(point.x); }} /></label>
                <label>y <input type="number" step="any" aria-label={`Point ${index + 1} y`} defaultValue={point.y} key={`${documentRevision}-${point.id}-y-${point.y}`} onBlur={(event) => { const value = event.currentTarget.valueAsNumber; if (Number.isFinite(value)) setPoints((previous) => previous.map((item) => item.id === point.id ? { ...item, y: value } : item)); else event.currentTarget.value = String(point.y); }} /></label>
                <button type="button" className="graphing-icon-button" aria-label={`Remove point ${index + 1}`} onClick={() => setPoints((previous) => previous.filter((item) => item.id !== point.id))}><Trash2 size={18} aria-hidden="true" /></button>
              </div>)}
              <button type="button" className="graphing-add-button" onClick={() => setPoints((previous) => [...previous, { id: crypto.randomUUID(), x: 0, y: 0, color: COLORS[(previous.length + 2) % COLORS.length], visible: true }])}><Plus size={18} aria-hidden="true" />Add point</button>
            </details>
<details className="graph-analysis" aria-label="Analysis"><summary>Analysis</summary>
              <button type="button" className="graphing-add-button graph-find-intersections" onClick={() => void findIntersections("crossings")}>Find intersections</button>
              <button type="button" className="graphing-add-button graph-find-intersections" onClick={() => void findIntersections("intercepts")}>Find intercepts</button>
              <p className="graphing-hint">Approximate crossings in the current view. Tangencies and some intersections may be missed. Search again after moving the view.</p>
              {crossingError && <p className="graphing-error" role="alert">{crossingError}</p>}
              {crossings && <div role="status">{crossings.length === 0 ? <p className="graphing-hint">No crossings found in this view.</p> : <ul className="graph-crossings">{crossings.map((crossing, index) => <li key={`${crossing.first}-${crossing.second}-${index}`}><span>Functions {expressions.findIndex((item) => item.id === crossing.first) + 1} &amp; {expressions.findIndex((item) => item.id === crossing.second) + 1}: ({Number(crossing.x.toPrecision(6))}, {Number(crossing.y.toPrecision(6))})</span><button type="button" onClick={() => addAnalysisPoint(crossing.x, crossing.y)} aria-label={`Add intersection ${index + 1} as point`}>Add point</button></li>)}</ul>}</div>}
              {intercepts && <div role="status">{intercepts.length === 0 ? <p className="graphing-hint">No intercepts found in this view.</p> : <ul className="graph-crossings">{intercepts.map((intercept, index) => <li key={`${intercept.curve}-${intercept.axis}-${index}`}><span>Function {expressions.findIndex((item) => item.id === intercept.curve) + 1}, {intercept.axis}-axis: ({Number(intercept.x.toPrecision(6))}, {Number(intercept.y.toPrecision(6))})</span><button type="button" onClick={() => addAnalysisPoint(intercept.x, intercept.y)} aria-label={`Add intercept ${index + 1} as point`}>Add point</button></li>)}</ul>}</div>}
            </details>
              {parameters.length > 0 && <fieldset className="graph-presentation-settings"><legend>Interactive in presentation</legend>{parameters.map(({ name }) => <label key={name}><input type="checkbox" checked={interactiveParameters.includes(name)} onChange={(event) => setInteractiveParameters((previous) => event.target.checked ? [...previous, name] : previous.filter((item) => item !== name))} />{name}</label>)}</fieldset>}
            </> : <>
              {interactiveParameters.length === 0 && <p className="graphing-hint">No interactive sliders enabled. Switch to editor to choose presentation controls.</p>}
              <ParameterSliders presentation parameters={parameters.filter(({ name }) => interactiveParameters.includes(name))} onChange={(changed) => setParameters((previous) => previous.map((parameter) => changed.find(({ name }) => name === parameter.name) ?? parameter))} />
            </>}
          </div>
        </aside>
          <div className="graph-panel-resizer" role="separator" tabIndex={0} aria-label="Resize functions panel" aria-orientation="vertical" aria-controls={`${id}-expressions`} aria-valuemin={280} aria-valuemax={480} aria-valuenow={panelWidth}
            onPointerDown={(event) => { resizeStart.current = { x: event.clientX, width: event.currentTarget.previousElementSibling?.getBoundingClientRect().width ?? panelWidth }; event.currentTarget.setPointerCapture(event.pointerId); }}
            onPointerMove={(event) => { if (resizeStart.current) setPanelWidth(Math.max(280, Math.min(480, Math.round(resizeStart.current.width + event.clientX - resizeStart.current.x)))); }}
            onPointerUp={() => { resizeStart.current = null; }} onPointerCancel={() => { resizeStart.current = null; }}
            onKeyDown={(event) => { const delta = event.key === "ArrowRight" ? 10 : event.key === "ArrowLeft" ? -10 : 0; if (delta) { event.preventDefault(); setPanelWidth((width) => Math.max(280, Math.min(480, width + delta))); } }} />
        <section className="graphing-graph" aria-label="Interactive graph">
          <div className="graphing-toolbar" role="toolbar" aria-label="Graph controls">
            <button type="button" className="graphing-panel-toggle" aria-label={expressionsVisible ? "Hide functions panel" : "Show functions panel"} aria-expanded={expressionsVisible} aria-controls={`${id}-expressions`} onClick={() => setExpressionsVisible((visible) => !visible)}>
              {expressionsVisible ? <PanelLeftClose size={18} aria-hidden="true" /> : <PanelLeftOpen size={18} aria-hidden="true" />}<span>Functions</span>
            </button>
            <div className="graphing-view-controls">
              <button type="button" className="graphing-icon-button" aria-label="Zoom in" title="Zoom in" onClick={() => graphRef.current?.zoom(0.8)}><ZoomIn size={19} aria-hidden="true" /></button>
              <button type="button" className="graphing-icon-button" aria-label="Zoom out" title="Zoom out" onClick={() => graphRef.current?.zoom(1.25)}><ZoomOut size={19} aria-hidden="true" /></button>
              <button type="button" className="graphing-reset-button" onClick={() => graphRef.current?.reset()}><RotateCcw size={16} aria-hidden="true" />Reset view</button>
            </div>
          <details ref={settingsRef} className="graph-settings"><summary>Graph settings</summary><div className="graphing-trace-controls" role="group" aria-label="Coordinate readout settings">
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
          </div></details>
          </div>
          <GraphCanvas key={documentRevision} ref={graphRef} initialViewport={initialViewport} expressions={plottedExpressions} points={points} datasets={datasets} parameters={parameterValues} grid={grid} precision={precision} snapToGrid={snapToGrid} onErrors={setErrors} onPointMove={mode === "editor" ? (id, x, y) => setPoints((previous) => previous.map((point) => point.id === id ? { ...point, x, y } : point)) : undefined} />
          <p className="graphing-graph-hint">Hover over a curve to read coordinates; click to pin. Reset view returns to the origin.</p>
        </section>
      </div>
    </div>
  );
}

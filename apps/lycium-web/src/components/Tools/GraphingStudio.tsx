"use client";

import { useId, useMemo, useRef, useState } from "react";
import { Eye, EyeOff, PanelLeftClose, PanelLeftOpen, Plus, RotateCcw, Trash2, ZoomIn, ZoomOut } from "lucide-react";
import GraphCanvas, { type GraphCanvasHandle, type GraphExpression } from "./GraphCanvas";
import ParameterSliders from "./ParameterSliders";
import type { GraphParameter } from "./graphParameters";
import type { CoordinatePrecision } from "./graphCoordinates";
import "./graphingStudio.css";

const COLORS = ["#176b55", "#2563eb", "#c2410c", "#9333ea", "#be185d", "#0e7490"];
const DEFAULT_EXPRESSIONS: GraphExpression[] = [
  { expr: "x^2", id: "1", color: COLORS[0], visible: true },
  { expr: "sin(x)", id: "2", color: COLORS[1], visible: true },
];

export default function GraphingStudio({ workspace = false }: { workspace?: boolean }) {
  const [expressions, setExpressions] = useState(DEFAULT_EXPRESSIONS);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [grid, setGrid] = useState(true);
  const [precision, setPrecision] = useState<CoordinatePrecision>("auto");
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [parameters, setParameters] = useState<GraphParameter[]>([]);
  const parameterValues = useMemo(() => Object.fromEntries(parameters.map(({ name, value }) => [name, value])), [parameters]);
  const [expressionsVisible, setExpressionsVisible] = useState(true);
  const graphRef = useRef<GraphCanvasHandle>(null);
  const nextId = useRef(3);
  const id = useId();

  const updateExpression = (expressionId: string, update: Partial<GraphExpression>) => {
    setExpressions((previous) => previous.map((expression) => expression.id === expressionId ? { ...expression, ...update } : expression));
  };

  return (
    <div className={`graphing-studio${workspace ? " graphing-studio--workspace" : ""}`}>
      {!workspace && <header className="graphing-heading">
        <h1>Graphing Studio</h1>
        <p>Explore functions and compare their shapes. Drag to pan, scroll or pinch to zoom.</p>
      </header>}
      <div className={`graphing-layout${expressionsVisible ? "" : " graphing-layout--collapsed"}`}>
        <aside id={`${id}-expressions`} hidden={!expressionsVisible} className="graphing-expressions" aria-labelledby={`${id}-functions`}>
          <h2 id={`${id}-functions`}>Functions</h2>
          <p className="graphing-hint">Use x^2, sin(x), 2*x+1, or y=1/x. Angles are in radians.</p>
          <div className="graphing-expression-list">
            {expressions.map((expression, index) => (
              <div className="graphing-expression" key={expression.id} data-hidden={!expression.visible}>
                <div className="graphing-expression-row">
                  <span className="graphing-color" style={{ backgroundColor: expression.color }} aria-hidden="true" />
                  <input
                    aria-label={`Function ${index + 1}`}
                    aria-invalid={Boolean(errors[expression.id])}
                    aria-describedby={errors[expression.id] ? `${id}-error-${expression.id}` : undefined}
                    value={expression.expr}
                    maxLength={500}
                    placeholder="e.g. y=2*x+1"
                    autoComplete="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    onChange={(event) => updateExpression(expression.id, { expr: event.target.value })}
                  />
                  <button type="button" className="graphing-icon-button" aria-label={`${expression.visible ? "Hide" : "Show"} function ${index + 1}`} aria-pressed={expression.visible} title={expression.visible ? "Hide function" : "Show function"} onClick={() => updateExpression(expression.id, { visible: !expression.visible })}>
                    {expression.visible ? <Eye size={18} aria-hidden="true" /> : <EyeOff size={18} aria-hidden="true" />}
                  </button>
                  <button type="button" className="graphing-icon-button" aria-label={`Remove function ${index + 1}`} title="Remove function" onClick={() => setExpressions((previous) => previous.filter(({ id: expressionId }) => expressionId !== expression.id))}>
                    <Trash2 size={18} aria-hidden="true" />
                  </button>
                </div>
                {errors[expression.id] && <p className="graphing-error" id={`${id}-error-${expression.id}`} role="status">{errors[expression.id]}</p>}
              </div>
            ))}
            <button type="button" className="graphing-add-button" onClick={() => {
              const expressionId = nextId.current++;
              setExpressions((previous) => [...previous, { id: String(expressionId), expr: "", color: COLORS[(expressionId - 1) % COLORS.length], visible: true }]);
            }}><Plus size={18} aria-hidden="true" />Add function</button>
            {expressions.length === 0 && <p className="graphing-hint">Add a function to start plotting.</p>}
            <ParameterSliders parameters={parameters} onChange={setParameters} />
          </div>
        </aside>
        <section className="graphing-graph" aria-label="Interactive graph">
          <div className="graphing-toolbar" role="toolbar" aria-label="Graph controls">
            <button type="button" className="graphing-panel-toggle" aria-label={expressionsVisible ? "Hide functions panel" : "Show functions panel"} aria-expanded={expressionsVisible} aria-controls={`${id}-expressions`} onClick={() => setExpressionsVisible((visible) => !visible)}>
              {expressionsVisible ? <PanelLeftClose size={18} aria-hidden="true" /> : <PanelLeftOpen size={18} aria-hidden="true" />}<span>Functions</span>
            </button>
            <label className="graphing-grid-toggle"><input type="checkbox" checked={grid} onChange={(event) => setGrid(event.target.checked)} />Grid</label>
            <div className="graphing-view-controls">
              <button type="button" className="graphing-icon-button" aria-label="Zoom in" title="Zoom in" onClick={() => graphRef.current?.zoom(0.8)}><ZoomIn size={19} aria-hidden="true" /></button>
              <button type="button" className="graphing-icon-button" aria-label="Zoom out" title="Zoom out" onClick={() => graphRef.current?.zoom(1.25)}><ZoomOut size={19} aria-hidden="true" /></button>
              <button type="button" className="graphing-reset-button" onClick={() => graphRef.current?.reset()}><RotateCcw size={16} aria-hidden="true" />Reset view</button>
            </div>
          </div>
          <div className="graphing-trace-controls" role="group" aria-label="Coordinate readout settings">
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
          </div>
          <GraphCanvas ref={graphRef} expressions={expressions} parameters={parameterValues} grid={grid} precision={precision} snapToGrid={snapToGrid} onErrors={setErrors} />
          <p className="graphing-graph-hint">Hover over a curve to read coordinates. Reset view returns to the origin.</p>
        </section>
      </div>
    </div>
  );
}

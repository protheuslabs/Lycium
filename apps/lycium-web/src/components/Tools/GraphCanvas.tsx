"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { Chart, FunctionPlotDatum, FunctionPlotOptions } from "function-plot";
import { formatCoordinate, gridStepFromTicks, snapCoordinate, type CoordinatePrecision } from "./graphCoordinates";
import type { GraphPoint } from "./graphDocument";
import "./graphCanvas.css";

export interface GraphExpression {
  id: string;
  expr: string;
  color: string;
  visible: boolean;
}

export interface GraphCanvasHandle {
  reset: () => void;
  zoom: (factor: number) => void;
  getViewport: () => { x: [number, number]; y: [number, number] } | null;
}

type GraphCanvasProps = {
  expressions: readonly GraphExpression[];
  points?: readonly GraphPoint[];
  parameters?: Readonly<Record<string, number>>;
  grid: boolean;
  initialViewport?: { x: [number, number]; y: [number, number] } | null;
  precision?: CoordinatePrecision;
  snapToGrid?: boolean;
  onErrors: (errors: Record<string, string>) => void;
};

const NO_POINTS: readonly GraphPoint[] = [];
const NO_PARAMETERS: Readonly<Record<string, number>> = {};

// No page layout or course dependencies: the same plot can live in either host.
const GraphCanvas = forwardRef<GraphCanvasHandle, GraphCanvasProps>(function GraphCanvas(
  { expressions, points = NO_POINTS, parameters = NO_PARAMETERS, grid, initialViewport = null, precision = "auto", snapToGrid = false, onErrors },
  ref,
) {
  const initialViewportRef = useRef(initialViewport);
  const containerRef = useRef<HTMLDivElement>(null);
  const configRef = useRef({ expressions, points, parameters, grid, precision, snapToGrid });
  const controllerRef = useRef<GraphCanvasHandle & { redraw: () => void } | null>(null);
  const [status, setStatus] = useState("Loading graph…");
  const [pin, setPin] = useState<{ x: number; y: number; left: number; top: number; text: string } | null>(null);
  const pinRef = useRef<{ x: number; y: number } | null>(null);

  useImperativeHandle(ref, () => ({
    reset: () => controllerRef.current?.reset(),
    zoom: (factor) => controllerRef.current?.zoom(factor),
    getViewport: () => controllerRef.current?.getViewport() ?? null,
  }), []);

  useEffect(() => {
    configRef.current = { ...configRef.current, expressions, points, grid };
    // Avoid rebuilding for every keystroke while an expression is being entered.
    const timer = window.setTimeout(() => controllerRef.current?.redraw(), 150);
    return () => window.clearTimeout(timer);
  }, [expressions, points, grid]);

  useEffect(() => {
    configRef.current = { ...configRef.current, parameters };
    // Slider updates are frame-coalesced, rather than debounced like text edits.
    const frame = requestAnimationFrame(() => controllerRef.current?.redraw());
    return () => cancelAnimationFrame(frame);
  }, [parameters]);

  useEffect(() => {
    configRef.current = { ...configRef.current, precision, snapToGrid };
  }, [precision, snapToGrid]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;
    let observer: ResizeObserver | undefined;
    let frame = 0;
    let disposeChart = () => {};

    async function initialize() {
      try {
        const library = await import("function-plot");
        if (disposed || !container) return;
        const target = document.createElement("div");
        target.className = "graph-plot-target";
        container.replaceChildren(target);
        let chart: Chart | undefined;
        let options: FunctionPlotOptions;
        let lastWidth = 0;
        let lastHeight = 0;
        let trace: { x: number; y: number } | null = null;
        let pointerStart: { x: number; y: number } | null = null;

        const updatePin = () => {
          const current = pinRef.current;
          const meta = chart?.meta;
          if (!current || !meta?.xScale || !meta.yScale) return;
          setPin({ ...current, left: meta.xScale(current.x) + (meta.margin?.left ?? 0), top: meta.yScale(current.y) + (meta.margin?.top ?? 0), text: coordinateText(current.x, current.y) });
        };
        const startPointer = (event: PointerEvent) => { pointerStart = event.target instanceof Element && event.target.classList.contains("zoom-and-drag") ? { x: event.clientX, y: event.clientY } : null; };
        const endPointer = (event: PointerEvent) => {
          if (!pointerStart || Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 4) { pointerStart = null; return; }
          pointerStart = null;
          if (!trace) return;
          pinRef.current = { ...trace };
          updatePin();
        };
        target.addEventListener("pointerdown", startPointer);
        target.addEventListener("pointerup", endPointer);

        const release = () => {
          chart?.removeAllListeners();
          // function-plot caches instances; it has no destroy() API.
          if (options?.id) delete library.Chart.cache[options.id];
          chart = undefined;
          target.replaceChildren();
        };
        disposeChart = () => { target.removeEventListener("pointerdown", startPointer); target.removeEventListener("pointerup", endPointer); release(); };

        const coordinateText = (x: number, y: number) => {
          const xStep = gridStepFromTicks(chart?.meta.xScale?.ticks() ?? []);
          const yStep = gridStepFromTicks(chart?.meta.yScale?.ticks() ?? []);
          return `${formatCoordinate(x, xStep, configRef.current.precision)}, ${formatCoordinate(y, yStep, configRef.current.precision)}`;
        };

        const makeOptions = (xDomain?: number[], yDomain?: number[]): FunctionPlotOptions => ({
          target,
          xAxis: { domain: xDomain ?? [-10, 10], label: "x" },
          // An omitted y domain gives equal units per pixel on the initial view.
          yAxis: { domain: yDomain, label: "y" },
          tip: { xLine: true, yLine: true, renderer: (x, y) => `(${coordinateText(x, y)})` },
          data: [],
        });
        options = makeOptions(initialViewportRef.current?.x, initialViewportRef.current?.y);

        const draw = () => {
          if (disposed) return;
          const width = Math.floor(container.clientWidth);
          const height = Math.floor(container.clientHeight);
          // A hidden embed can be zero-sized. Wait for its host to reveal it.
          if (width < 100 || height < 100) return;
          const data: FunctionPlotDatum[] = [];
          const errors: Record<string, string> = {};
          for (const expression of configRef.current.expressions) {
            const fn = expression.expr.trim().replace(/^y\s*=\s*/i, "");
            if (!fn) continue;
            const datum: FunctionPlotDatum = {
              fn,
              color: expression.color,
              scope: { ...configRef.current.parameters },
              graphType: "interval",
              sampler: "interval",
            };
            try {
              if (fn.includes("=")) throw new Error("Only functions of x are supported. Use y= followed by an expression; equations such as x=2 are not yet supported.");
              // Validate using the library's evaluators, not a separate parser.
              // Undefined numeric results are valid (e.g. 1/x or sqrt(x)).
              library.EvalInterval(datum, "fn", { x: { lo: 0.5, hi: 0.5 } });
              library.EvalBuiltIn(datum, "fn", { x: 0.5 });
              if (expression.visible) data.push(datum);
            } catch (cause) {
              errors[expression.id] = cause instanceof Error ? cause.message : "Check the expression syntax.";
            }
          }
          onErrors(errors);
          for (const point of configRef.current.points) {
            if (point.visible) data.push({ fn: `point-${point.id}`, fnType: "points", graphType: "scatter", points: [[point.x, point.y]], color: point.color, skipTip: true });
          }
          options.data = data;
          options.grid = configRef.current.grid;
          options.width = width;
          options.height = height;
          lastWidth = width;
          lastHeight = height;
          try {
            const previousChart = chart;
            chart = library.default(options);
            if (chart !== previousChart) {
              let hasTracePoint = false;
              // The library evaluates y from the adjusted x, keeping the marker on
              // the curve. Never independently round or snap the y coordinate.
              chart.on("before:mousemove", (coordinates: { x: number; y: number }) => {
                hasTracePoint = false;
                trace = null;
                const legend = target.querySelector(".top-right-legend");
                if (legend) legend.textContent = "";
                if (!configRef.current.snapToGrid) return;
                const ticks = chart?.meta.xScale?.ticks() ?? [];
                const domain = chart?.meta.xScale?.domain() ?? [];
                coordinates.x = snapCoordinate(coordinates.x, gridStepFromTicks(ticks), domain);
              });
              chart.on("tip:update", ({ x, y }: { x: number; y: number }) => {
                if (!Number.isFinite(x) || !Number.isFinite(y)) return;
                hasTracePoint = true;
                trace = { x, y };
                chart?.tip.show();
                const legend = target.querySelector(".top-right-legend");
                if (legend) legend.textContent = coordinateText(x, y);
              });
              chart.on("mousemove", () => {
                if (!hasTracePoint) chart?.tip.hide();
              });
              chart.on("after:draw", updatePin);
            }
            updatePin();
            setStatus("");
          } catch (cause) {
            setStatus(cause instanceof Error ? `Unable to draw graph: ${cause.message}` : "Unable to draw graph.");
          }
        };

        controllerRef.current = {
          redraw: draw,
          getViewport: () => {
            const x = options.xAxis?.domain;
            const y = options.yAxis?.domain;
            return x && y && x.length === 2 && y.length === 2 ? { x: [x[0], x[1]], y: [y[0], y[1]] } : null;
          },
          reset: () => {
            release();
            options = makeOptions();
            draw();
          },
          zoom: (factor) => {
            const x = options.xAxis?.domain;
            const y = options.yAxis?.domain;
            if (!x || !y || !Number.isFinite(factor) || factor <= 0) return;
            const scale = (domain: number[]) => {
              const center = (domain[0] + domain[1]) / 2;
              const half = (domain[1] - domain[0]) * factor / 2;
              return [center - half, center + half];
            };
            const nextX = scale(x);
            const nextY = scale(y);
            if (![...nextX, ...nextY].every(Number.isFinite) || nextX[0] === nextX[1] || nextY[0] === nextY[1]) return;
            release();
            options = makeOptions(nextX, nextY);
            draw();
          },
        };
        draw();
        observer = new ResizeObserver(() => {
          const width = Math.floor(container.clientWidth);
          const height = Math.floor(container.clientHeight);
          if (width === lastWidth && height === lastHeight) return;
          cancelAnimationFrame(frame);
          frame = requestAnimationFrame(draw);
        });
        observer.observe(container);
      } catch (cause) {
        if (!disposed) setStatus(cause instanceof Error ? `Unable to load graph: ${cause.message}` : "Unable to load graph.");
      }
    }

    void initialize();
    return () => {
      disposed = true;
      observer?.disconnect();
      cancelAnimationFrame(frame);
      controllerRef.current = null;
      disposeChart();
      container.replaceChildren();
    };
  }, [onErrors]);

  return (
    <div className="graph-surface">
      <div ref={containerRef} className="graph-viewport" role="img" aria-label="Cartesian graph of the visible functions" />
      {pin && <>
        <div className="graph-pin" style={{ left: pin.left, top: pin.top }} aria-hidden="true"><span>{pin.text}</span></div>
        <button type="button" className="graph-clear-pin" onClick={() => { pinRef.current = null; setPin(null); }} aria-label={`Clear pinned point ${pin.text}`}>Clear pinned point ({pin.text})</button>
      </>}
      {status && <p className="graph-status" role="status">{status}</p>}
    </div>
  );
});

export default GraphCanvas;

"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { Chart, FunctionPlotDatum, FunctionPlotOptions } from "function-plot";
import { formatCoordinate, gridStepFromTicks, snapCoordinate, type CoordinatePrecision } from "./graphCoordinates";
import { createGraphDecorations } from "./graphDecorations";
import type { GraphLabels, GraphPoint } from "./graphDocument";
import { graphExpressionCurve, prepareGraphPieces, type GraphExpression } from "./graphExpressions";
import { findCrossings, findIntercepts, type Curve } from "./graphIntersections";
import { exponentialRegression, linearRegression, numericPoints, type GraphDataset } from "./graphDataset";
import "./graphCanvas.css";

export interface GraphCanvasHandle {
  reset: () => void;
  zoom: (factor: number) => void;
  getViewport: () => { x: [number, number]; y: [number, number] } | null;
  getAspectRatio: () => number | null;
  setViewport: (viewport: { x: [number, number]; y: [number, number] }) => void;
  exportImage: (format: "svg" | "png") => Promise<void>;
}

type GraphCanvasProps = {
  expressions: readonly GraphExpression[];
  selectedExpressionId?: string | null;
  points?: readonly GraphPoint[];
  datasets?: readonly GraphDataset[];
  labels?: GraphLabels;
  parameters?: Readonly<Record<string, number>>;
  grid: boolean;
  initialViewport?: { x: [number, number]; y: [number, number] } | null;
  precision?: CoordinatePrecision;
  snapToGrid?: boolean;
  accessibleLabel?: string;
  onErrors: (errors: Record<string, string>) => void;
  onPointMove?: (id: string, x: number, y: number) => void;
  areaRegion?: { first: string; second: string; start: number; end: number } | null;
  onAreaBoundMove?: (bound: "start" | "end", x: number) => void;
};

const NO_POINTS: readonly GraphPoint[] = [];
const NO_DATASETS: readonly GraphDataset[] = [];
const NO_LABELS: GraphLabels = { title: "", xTitle: "", xUnit: "", yTitle: "", yUnit: "", annotations: [] };
const NO_PARAMETERS: Readonly<Record<string, number>> = {};

// No page layout or course dependencies: the same plot can live in either host.
const GraphCanvas = forwardRef<GraphCanvasHandle, GraphCanvasProps>(function GraphCanvas(
  { expressions, selectedExpressionId = null, points = NO_POINTS, datasets = NO_DATASETS, labels = NO_LABELS, parameters = NO_PARAMETERS, grid, initialViewport = null, precision = "auto", snapToGrid = false, accessibleLabel = "Cartesian graph of the visible functions", onErrors, onPointMove, areaRegion = null, onAreaBoundMove },
  ref,
) {
  const initialViewportRef = useRef(initialViewport);
  const containerRef = useRef<HTMLDivElement>(null);
  const configRef = useRef({ expressions, selectedExpressionId, points, datasets, labels, parameters, grid, precision, snapToGrid, areaRegion });
  const lastErrorsRef = useRef<Record<string, string>>({});
  const controllerRef = useRef<(Omit<GraphCanvasHandle, "exportImage"> & { redraw: () => void }) | null>(null);
  const [status, setStatus] = useState("Loading graph…");
  const [pin, setPin] = useState<{ x: number; y: number; left: number; top: number; text: string } | null>(null);
  const pinRef = useRef<{ x: number; y: number } | null>(null);
  const pointMoveRef = useRef(onPointMove);
  pointMoveRef.current = onPointMove;
  const pointCoordsRef = useRef<((clientX: number, clientY: number) => { x: number; y: number } | null) | null>(null);
  const [pointPositions, setPointPositions] = useState<Array<{ id: string; left: number; top: number; color: string }>>([]);
  const [areaPositions, setAreaPositions] = useState<{ start: number; end: number } | null>(null);
  const areaCoordRef = useRef<((clientX: number) => number) | null>(null);

  useImperativeHandle(ref, () => ({
    reset: () => controllerRef.current?.reset(),
    zoom: (factor) => controllerRef.current?.zoom(factor),
    getViewport: () => controllerRef.current?.getViewport() ?? null,
    getAspectRatio: () => controllerRef.current?.getAspectRatio() ?? null,
    setViewport: (viewport) => controllerRef.current?.setViewport(viewport),
    exportImage: async (format) => {
      const source = containerRef.current?.querySelector("svg.function-plot");
      if (!(source instanceof SVGSVGElement)) throw new Error("The graph is not ready to export.");
      const { x, y, width, height } = source.viewBox.baseVal;
      if (!(width > 0 && height > 0)) throw new Error("The graph has no visible size to export.");
      const clone = source.cloneNode(true) as SVGSVGElement;
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      clone.setAttribute("width", String(width));
      clone.setAttribute("height", String(height));
      const originals = [source, ...source.querySelectorAll("*")];
      const copies = [clone, ...clone.querySelectorAll("*")];
      originals.forEach((element, index) => {
        const copy = copies[index];
        const style = getComputedStyle(element);
        for (const property of ["fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "opacity", "font-family", "font-size", "font-weight", "text-anchor", "display", "visibility"]) {
          const value = style.getPropertyValue(property);
          if (value) (copy as SVGElement).style.setProperty(property, value);
        }
        if (element.classList.contains("scatter")) copy.setAttribute("r", "5");
      });
      clone.querySelectorAll(".zoom-and-drag, .tip, .top-right-legend").forEach((node) => node.remove());
      clone.querySelectorAll(".graph-curve-entrance").forEach((node) => node.classList.remove("graph-curve-entrance"));
      const background = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      background.setAttribute("x", String(x)); background.setAttribute("y", String(y));
      background.setAttribute("width", String(width)); background.setAttribute("height", String(height)); background.setAttribute("fill", "#ffffff");
      clone.insertBefore(background, clone.firstChild);
      const svg = new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml;charset=utf-8" });
      let blob = svg;
      if (format === "png") {
        const svgUrl = URL.createObjectURL(svg);
        try {
          const image = new Image();
          await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("Could not render the graph image.")); image.src = svgUrl; });
          const canvas = document.createElement("canvas");
          const scale = Math.min(2, 8192 / Math.max(width, height));
          canvas.width = Math.floor(width * scale); canvas.height = Math.floor(height * scale);
          const context = canvas.getContext("2d");
          if (!context) throw new Error("Image export is not supported by this browser.");
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          const result = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
          if (!result) throw new Error("Could not create the PNG image.");
          blob = result;
        } finally { URL.revokeObjectURL(svgUrl); }
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a"); link.href = url; link.download = `lycium-graph.${format}`; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
  }), []);

  useEffect(() => {
    configRef.current = { ...configRef.current, expressions, selectedExpressionId, points, datasets, labels, grid, areaRegion };
    // Redraw on the next paint so slider-driven expression changes stay live
    // without queuing multiple expensive plot rebuilds per frame.
    const frame = requestAnimationFrame(() => controllerRef.current?.redraw());
    return () => cancelAnimationFrame(frame);
  }, [expressions, selectedExpressionId, points, datasets, labels, grid, areaRegion]);

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
        let maintainEqualScale = !initialViewportRef.current;
        let trace: { x: number; y: number } | null = null;
        let pointerStart: { x: number; y: number } | null = null;
        const drawnExpressions = new Set<string>();
        let entranceFrame = 0;

        const updatePointPositions = () => {
          const meta = chart?.meta;
          if (!meta?.xScale || !meta.yScale) return;
          const xScale = meta.xScale, yScale = meta.yScale;
          const region = configRef.current.areaRegion;
          setAreaPositions(region ? { start: xScale(region.start), end: xScale(region.end) } : null);
          areaCoordRef.current = (clientX) => xScale.invert(clientX - container.getBoundingClientRect().left);
          setPointPositions(configRef.current.points.filter((point) => point.visible).map((point) => ({
            id: point.id, color: point.color,
            left: xScale(point.x),
            top: yScale(point.y),
          })));
        };
        pointCoordsRef.current = (clientX, clientY) => {
          const meta = chart?.meta;
          if (!meta?.xScale || !meta.yScale) return null;
          const bounds = container.getBoundingClientRect();
          const x = meta.xScale.invert(clientX - bounds.left);
          const y = meta.yScale.invert(clientY - bounds.top);
          if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
          const step = Math.min(gridStepFromTicks(meta.xScale.ticks()), gridStepFromTicks(meta.yScale.ticks())) / 5;
          const snapped = { x: snapCoordinate(x, step, meta.xScale.domain()), y: snapCoordinate(y, step, meta.yScale.domain()) };
          try {
            const curves: Curve[] = configRef.current.expressions.filter((expression) => expression.visible && expression.expr.trim()).flatMap((expression) => {
              try { return [graphExpressionCurve(expression, configRef.current.parameters, library)]; }
              catch { return []; }
            });
            const candidates = [
              ...findIntercepts(curves, meta.xScale.domain() as [number, number], meta.yScale.domain() as [number, number]),
              ...findCrossings(curves.slice(0, 8), meta.xScale.domain() as [number, number]),
            ];
            let nearest = 20;
            for (const candidate of candidates) {
              const distance = Math.hypot(meta.xScale(candidate.x) - meta.xScale(x), meta.yScale(candidate.y) - meta.yScale(y));
              if (distance < nearest) { nearest = distance; snapped.x = candidate.x; snapped.y = candidate.y; }
            }
          } catch { /* Invalid expressions still allow grid snapping. */ }
          return snapped;
        };

        const updatePin = () => {
          const current = pinRef.current;
          const meta = chart?.meta;
          if (!current || !meta?.xScale || !meta.yScale) return;
          setPin({ ...current, left: meta.xScale(current.x), top: meta.yScale(current.y), text: coordinateText(current.x, current.y) });
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

        const { gridStep, updateGrid, updateLabels, updateFunctionEmphasis } = createGraphDecorations({ target, getChart: () => chart, configRef, library });

        const animateNewExpressions = () => {
          const svg = target.querySelector("svg.function-plot");
          if (!svg) return;
          const ids = configRef.current.expressions.filter((expression) => expression.visible && expression.id !== "__tangent__").flatMap((expression) => {
            try { return prepareGraphPieces(expression, configRef.current.parameters, library).map(() => expression.id); }
            catch { return []; }
          });
          const groups = [...svg.querySelectorAll<SVGGElement>(".graph")];
          const newlyDrawn = new Set(ids.filter((id) => !drawnExpressions.has(id)));
          ids.forEach((id, index) => {
            const group = groups[index];
            if (!group || !newlyDrawn.has(id)) return;
            group.classList.add("graph-curve-entrance");
            group.addEventListener("animationend", () => group.classList.remove("graph-curve-entrance"), { once: true });
          });
          newlyDrawn.forEach((id) => drawnExpressions.add(id));
        };

        const makeOptions = (xDomain?: number[], yDomain?: number[]): FunctionPlotOptions => ({
          target,
          xAxis: { domain: xDomain ?? [-10, 10], label: "" },
          // An omitted y domain gives equal units per pixel on the initial view.
          yAxis: { domain: yDomain, label: "" },
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
            try {
              const pieces = prepareGraphPieces(expression, configRef.current.parameters, library);
              if (expression.visible) data.push(...pieces.map(({ datum }) => datum));
            } catch (cause) {
              errors[expression.id] = cause instanceof Error ? cause.message : "Check the expression syntax.";
            }
          }
          const previousErrors = lastErrorsRef.current;
          if (Object.keys(errors).length !== Object.keys(previousErrors).length || Object.entries(errors).some(([key, message]) => previousErrors[key] !== message)) {
            lastErrorsRef.current = errors;
            onErrors(errors);
          }
          for (const point of configRef.current.points) {
            if (point.visible) data.push({ fn: `point-${point.id}`, fnType: "points", graphType: "scatter", points: [[point.x, point.y]], color: point.color, skipTip: true });
          }
          for (const dataset of configRef.current.datasets) {
            if (!dataset.visible) continue;
            const points = numericPoints(dataset.rows);
            if (points.length) data.push({ fnType: "points", graphType: "scatter", points, color: dataset.color, skipTip: true });
            if (dataset.connected && points.length > 1) data.push({ fnType: "points", graphType: "polyline", points, color: dataset.color, skipTip: true });
            const fit = dataset.regression && dataset.fitType !== "exponential" ? linearRegression(points) : null;
            const exp = dataset.regression && dataset.fitType === "exponential" ? exponentialRegression(points) : null;
            if (fit) data.push({ fn: `(${fit.slope})*x+(${fit.intercept})`, graphType: "polyline", sampler: "builtIn", color: dataset.color, skipTip: true });
            if (exp) data.push({ fn: `(${exp.a})*exp((${exp.b})*x)`, graphType: "polyline", sampler: "builtIn", color: dataset.color, skipTip: true });
          }
          options.data = data;
          options.grid = false;
              // function-plot reserves fixed Cartesian gutters. Give it room for
              // those gutters, then show only the plot at its original pixel scale.
          options.width = width + 60;
          options.height = height + 40;
          lastWidth = width;
          lastHeight = height;
          try {
            const previousChart = chart;
            chart = library.default(options);
            const svg = target.querySelector("svg.function-plot");
            const margin = chart.meta.margin;
            if (svg && margin) svg.setAttribute("viewBox", `${margin.left} ${margin.top} ${chart.meta.width} ${chart.meta.height}`);
            if (chart !== previousChart) {
              let hasTracePoint = false;
              // The library evaluates y from the adjusted x, keeping the marker on
              // the curve. Never independently round or snap the y coordinate.
              chart.on("before:mousemove", (coordinates: { x: number; y: number }) => {
                hasTracePoint = false;
                trace = null;
                if (!configRef.current.snapToGrid) return;
                const domain = chart?.meta.xScale?.domain() ?? [];
                // The visible grid divides each major unit into five cells. Snap
                // hover positions to that smallest cell so the readout and trace
                // marker land on a useful, predictable coordinate.
                coordinates.x = snapCoordinate(coordinates.x, gridStep() / 5, domain);
              });
              chart.on("tip:update", ({ x, y }: { x: number; y: number }) => {
                if (!Number.isFinite(x) || !Number.isFinite(y)) return;
                hasTracePoint = true;
                trace = { x, y };
                chart?.tip.show();
              });
              chart.on("mousemove", () => {
                if (!hasTracePoint) chart?.tip.hide();
              });
              chart.on("after:draw", () => { updateGrid(); updateLabels(); updateFunctionEmphasis(); updatePin(); updatePointPositions(); });
            }
            updateGrid();
            updateLabels();
            updateFunctionEmphasis();
            cancelAnimationFrame(entranceFrame);
            entranceFrame = requestAnimationFrame(animateNewExpressions);
            updatePin();
            updatePointPositions();
            setStatus("");
          } catch (cause) {
            setStatus(cause instanceof Error ? `Unable to draw graph: ${cause.message}` : "Unable to draw graph.");
          }
        };

        const normalizeScale = () => {
          const xScale = chart?.meta.xScale, yScale = chart?.meta.yScale;
          if (!xScale || !yScale) return;
          const x = xScale.domain(), y = yScale.domain();
          const xRange = xScale.range(), yRange = yScale.range();
          const xPixels = Math.abs((xRange[1] - xRange[0]) / (x[1] - x[0]));
          const yPixels = Math.abs((yRange[1] - yRange[0]) / (y[1] - y[0]));
          if (!Number.isFinite(xPixels) || !Number.isFinite(yPixels) || !xPixels || !yPixels) return;
          const center = (y[0] + y[1]) / 2;
          const half = Math.abs(y[1] - y[0]) * yPixels / xPixels / 2;
          release();
          options = makeOptions(x, [center - half, center + half]);
          draw();
        };

        const hasEqualScale = () => {
          const x = chart?.meta.xScale, y = chart?.meta.yScale;
          if (!x || !y) return false;
          const xd = x.domain(), yd = y.domain(), xr = x.range(), yr = y.range();
          const xPixels = Math.abs((xr[1] - xr[0]) / (xd[1] - xd[0]));
          const yPixels = Math.abs((yr[1] - yr[0]) / (yd[1] - yd[0]));
          return xPixels > 0 && yPixels > 0 && Math.abs(xPixels / yPixels - 1) < 0.001;
        };

        controllerRef.current = {
          redraw: draw,
          getViewport: () => {
            const x = options.xAxis?.domain;
            const y = options.yAxis?.domain;
            return x && y && x.length === 2 && y.length === 2 ? { x: [x[0], x[1]], y: [y[0], y[1]] } : null;
          },
          getAspectRatio: () => {
            const x = chart?.meta.xScale?.range(), y = chart?.meta.yScale?.range();
            return x && y && x.length === 2 && y.length === 2 && y[0] !== y[1] ? Math.abs((x[1] - x[0]) / (y[1] - y[0])) : null;
          },
          reset: () => {
            maintainEqualScale = true;
            release();
            options = makeOptions();
            draw();
            normalizeScale();
          },
          setViewport: (viewport) => {
            if (![...viewport.x, ...viewport.y].every(Number.isFinite) || viewport.x[0] >= viewport.x[1] || viewport.y[0] >= viewport.y[1] || !Number.isFinite(viewport.x[1] - viewport.x[0]) || !Number.isFinite(viewport.y[1] - viewport.y[0])) return;
            release();
            options = makeOptions(viewport.x, viewport.y);
            draw();
            maintainEqualScale = hasEqualScale();
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
        if (!initialViewportRef.current) normalizeScale();
        else maintainEqualScale = hasEqualScale();
        observer = new ResizeObserver(() => {
          const width = Math.floor(container.clientWidth);
          const height = Math.floor(container.clientHeight);
          if (width === lastWidth && height === lastHeight) return;
          cancelAnimationFrame(frame);
          frame = requestAnimationFrame(() => { draw(); if (maintainEqualScale) normalizeScale(); });
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
      pointCoordsRef.current = null;
      areaCoordRef.current = null;
      disposeChart();
      container.replaceChildren();
    };
  }, [onErrors]);

  return (
    <div className="graph-surface">
      <div ref={containerRef} className="graph-viewport" role="img" aria-label={accessibleLabel} />
      {areaPositions && onAreaBoundMove && (["start", "end"] as const).map((bound) => <button key={bound} type="button" className="graph-area-bound" style={{ left: areaPositions[bound] }} aria-label={`Move ${bound} area boundary`} title={`Drag ${bound} boundary`} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); event.preventDefault(); }} onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) { const x = areaCoordRef.current?.(event.clientX); if (x !== undefined && Number.isFinite(x)) onAreaBoundMove(bound, x); } }} />)}
      {onPointMove && pointPositions.map((point, index) => <button key={point.id} type="button" className="graph-draggable-point" style={{ left: point.left, top: point.top, color: point.color }} aria-label={`Move point ${index + 1}`} title="Drag or use arrow keys to move point" onKeyDown={(event) => {
        const offset: Record<string, [number, number]> = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] };
        if (!offset[event.key] || !containerRef.current) return;
        event.preventDefault();
        const bounds = containerRef.current.getBoundingClientRect();
        const coords = pointCoordsRef.current?.(bounds.left + point.left + offset[event.key][0], bounds.top + point.top + offset[event.key][1]);
        if (coords) pointMoveRef.current?.(point.id, Number(coords.x.toPrecision(8)), Number(coords.y.toPrecision(8)));
      }} onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        const coords = pointCoordsRef.current?.(event.clientX, event.clientY);
        if (coords && containerRef.current) {
          pointMoveRef.current?.(point.id, Number(coords.x.toPrecision(8)), Number(coords.y.toPrecision(8)));
        }
      }} />)}
      {pin && <>
        <div className="graph-pin" style={{ left: pin.left, top: pin.top }} aria-hidden="true"><span>{pin.text}</span></div>
        <button type="button" className="graph-clear-pin" onClick={() => { pinRef.current = null; setPin(null); }} aria-label={`Clear pinned point ${pin.text}`}>Clear pinned point ({pin.text})</button>
      </>}
      {status && <p className="graph-status" role="status">{status}</p>}
    </div>
  );
});

export default GraphCanvas;

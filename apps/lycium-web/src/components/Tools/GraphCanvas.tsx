"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { Chart, FunctionPlotDatum, FunctionPlotOptions } from "function-plot";
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
}

type GraphCanvasProps = {
  expressions: readonly GraphExpression[];
  grid: boolean;
  onErrors: (errors: Record<string, string>) => void;
};

// No page layout or course dependencies: the same plot can live in either host.
const GraphCanvas = forwardRef<GraphCanvasHandle, GraphCanvasProps>(function GraphCanvas(
  { expressions, grid, onErrors },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const configRef = useRef({ expressions, grid });
  const controllerRef = useRef<GraphCanvasHandle & { redraw: () => void } | null>(null);
  const [status, setStatus] = useState("Loading graph…");

  useImperativeHandle(ref, () => ({
    reset: () => controllerRef.current?.reset(),
    zoom: (factor) => controllerRef.current?.zoom(factor),
  }), []);

  useEffect(() => {
    configRef.current = { expressions, grid };
    // Avoid rebuilding for every keystroke while an expression is being entered.
    const timer = window.setTimeout(() => controllerRef.current?.redraw(), 150);
    return () => window.clearTimeout(timer);
  }, [expressions, grid]);

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

        const release = () => {
          chart?.removeAllListeners();
          // function-plot caches instances; it has no destroy() API.
          if (options?.id) delete library.Chart.cache[options.id];
          chart = undefined;
          target.replaceChildren();
        };
        disposeChart = release;

        const makeOptions = (xDomain?: number[], yDomain?: number[]): FunctionPlotOptions => ({
          target,
          xAxis: { domain: xDomain ?? [-10, 10], label: "x" },
          // An omitted y domain gives equal units per pixel on the initial view.
          yAxis: { domain: yDomain, label: "y" },
          tip: { xLine: true, yLine: true },
          data: [],
        });
        options = makeOptions();

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
              graphType: "interval",
              sampler: "interval",
            };
            try {
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
          options.data = data;
          options.grid = configRef.current.grid;
          options.width = width;
          options.height = height;
          lastWidth = width;
          lastHeight = height;
          try {
            chart = library.default(options);
            setStatus("");
          } catch (cause) {
            setStatus(cause instanceof Error ? `Unable to draw graph: ${cause.message}` : "Unable to draw graph.");
          }
        };

        controllerRef.current = {
          redraw: draw,
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
      {status && <p className="graph-status" role="status">{status}</p>}
    </div>
  );
});

export default GraphCanvas;

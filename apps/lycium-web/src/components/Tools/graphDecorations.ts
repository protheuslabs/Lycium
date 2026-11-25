import type { Chart } from "function-plot";
import { formatCoordinate, gridStepFromTicks } from "./graphCoordinates";
import type { GraphLabels } from "./graphDocument";
import { graphExpressionCurve, prepareGraphPieces, type GraphExpression } from "./graphExpressions";

type DecorationConfig = {
  grid: boolean;
  labels: GraphLabels;
  expressions: readonly GraphExpression[];
  parameters: Readonly<Record<string, number>>;
  selectedExpressionId: string | null;
  areaRegion: { first: string; second: string; start: number; end: number } | null;
};

export function createGraphDecorations({ target, getChart, configRef, library }: {
  target: HTMLElement;
  getChart: () => Chart | undefined;
  configRef: { current: DecorationConfig };
  library: typeof import("function-plot");
}) {
        // function-plot chooses tick intervals independently for each axis. Draw
        // one shared interval so equal axis scales also produce square cells.
        const gridStep = () => {
          const x = getChart()?.meta.xScale?.ticks() ?? [];
          const y = getChart()?.meta.yScale?.ticks() ?? [];
          return Math.min(gridStepFromTicks(x), gridStepFromTicks(y));
        };
        const updateGrid = () => {
          const svg = target.querySelector("svg.function-plot");
          svg?.querySelector(".graph-custom-grid")?.remove();
          const meta = getChart()?.meta;
          if (!svg || !meta?.xScale || !meta.yScale || !configRef.current.grid) return;
          const step = gridStep();
          if (!Number.isFinite(step) || step <= 0) return;
          const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
          group.classList.add("graph-custom-grid");
          group.dataset.step = String(step);
          const xRange = meta.xScale.range(), yRange = meta.yScale.range();
          const left = Math.min(...xRange) + (meta.margin?.left ?? 0);
          const right = Math.max(...xRange) + (meta.margin?.left ?? 0);
          const top = Math.min(...yRange) + (meta.margin?.top ?? 0);
          const bottom = Math.max(...yRange) + (meta.margin?.top ?? 0);
          const addLines = (axis: "x" | "y") => {
            const scale = axis === "x" ? meta.xScale : meta.yScale;
            if (!scale) return;
            const domain = scale.domain();
            const minorStep = step / 5;
            const first = Math.ceil(Math.min(...domain) / minorStep);
            const last = Math.floor(Math.max(...domain) / minorStep);
            if (!Number.isFinite(first) || !Number.isFinite(last) || last - first > 1000) return;
            for (let index = first; index <= last; index++) {
              const position = scale(index * minorStep) + (axis === "x" ? meta.margin?.left ?? 0 : meta.margin?.top ?? 0);
              const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
              line.dataset.axis = axis;
              line.classList.add(Math.abs(index % 5) === 0 ? "graph-grid-major" : "graph-grid-minor");
              line.setAttribute("x1", String(axis === "x" ? position : left));
              line.setAttribute("x2", String(axis === "x" ? position : right));
              line.setAttribute("y1", String(axis === "x" ? top : position));
              line.setAttribute("y2", String(axis === "x" ? bottom : position));
              group.appendChild(line);
            }
          };
          addLines("x"); addLines("y");
          svg.insertBefore(group, svg.firstChild);
        };

        const updateLabels = () => {
          const svg = target.querySelector("svg.function-plot"), meta = getChart()?.meta;
          svg?.querySelector(".graph-scientific-labels")?.remove();
          if (!svg || !meta?.xScale || !meta.yScale) return;
          const labels = configRef.current.labels, width = Number(svg.getAttribute("width")), height = Number(svg.getAttribute("height"));
          const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
          group.classList.add("graph-scientific-labels");
          const add = (text: string, x: number, y: number, rotate = false) => {
            if (!text) return;
            const node = document.createElementNS("http://www.w3.org/2000/svg", "text");
            node.textContent = text; node.setAttribute("x", String(x)); node.setAttribute("y", String(y));
            node.setAttribute("text-anchor", "middle"); node.setAttribute("fill", "#171717"); node.setAttribute("font-size", "14");
            if (rotate) node.setAttribute("transform", `rotate(-90 ${x} ${y})`);
            group.appendChild(node);
          };
          const axisLabel = (title: string, unit: string) => title && unit ? `${title} (${unit})` : title || unit;
          add(labels.title, width / 2, (meta.margin?.top ?? 0) + 18);
          const [x0, x1] = meta.xScale.domain(), [y0, y1] = meta.yScale.domain();
          const left = meta.margin?.left ?? 0, top = meta.margin?.top ?? 0;
          const xAxisPosition = Math.min(height - (meta.margin?.bottom ?? 0) - 8, Math.max(top + 14, meta.yScale(0) + top + 18));
          const yAxisPosition = Math.min(width - (meta.margin?.right ?? 0) - 8, Math.max(left + 26, meta.xScale(0) + left - 18));
          add(axisLabel(labels.xTitle, labels.xUnit), width / 2, xAxisPosition);
          add(axisLabel(labels.yTitle, labels.yUnit), yAxisPosition, height / 2, true);
          const numbers = document.createElementNS("http://www.w3.org/2000/svg", "g");
          numbers.classList.add("graph-axis-numbers");
          const xStep = gridStepFromTicks(meta.xScale.ticks()), yStep = gridStepFromTicks(meta.yScale.ticks());
          const addNumber = (value: number, step: number, x: number, y: number, anchor: "start" | "middle" | "end") => {
            const node = document.createElementNS("http://www.w3.org/2000/svg", "text");
            node.textContent = formatCoordinate(value, step);
            node.setAttribute("x", String(x)); node.setAttribute("y", String(y)); node.setAttribute("text-anchor", anchor);
            node.setAttribute("fill", "#171717"); node.setAttribute("font-size", "12");
            numbers.appendChild(node);
          };
          const originX = meta.xScale(0) + left, originY = meta.yScale(0) + top;
          for (const value of meta.xScale.ticks()) {
            if (value === 0) addNumber(value, xStep, originX - 5, originY + 16, "end");
            else addNumber(value, xStep, meta.xScale(value) + left, xAxisPosition, "middle");
          }
          for (const value of meta.yScale.ticks()) if (value !== 0) addNumber(value, yStep, yAxisPosition, meta.yScale(value) + top + 4, "end");
          group.appendChild(numbers);
          const region = configRef.current.areaRegion;
          if (region) try {
            const first = configRef.current.expressions.find((item) => item.id === region.first);
            const second = configRef.current.expressions.find((item) => item.id === region.second);
            if (first && second) {
              const a = graphExpressionCurve(first, configRef.current.parameters, library), b = graphExpressionCurve(second, configRef.current.parameters, library);
              const lower = Math.max(Math.min(region.start, region.end), Math.min(x0, x1)), upper = Math.min(Math.max(region.start, region.end), Math.max(x0, x1));
              const paths: string[] = [];
              if (upper > lower) for (let i = 0; i < 256; i++) {
                const xA = lower + (upper - lower) * i / 256, xB = lower + (upper - lower) * (i + 1) / 256;
                const values = [a.evaluate(xA), a.evaluate(xB), b.evaluate(xB), b.evaluate(xA)];
                const intervals = [a.interval(xA, xB), b.interval(xA, xB)];
                if (!values.every(Number.isFinite) || intervals.some((v) => !Number.isFinite(v.lo) || !Number.isFinite(v.hi) || v.lo > v.hi)) continue;
                const clampY = (y: number) => Math.max(Math.min(y, Math.max(y0, y1)), Math.min(y0, y1));
                paths.push(`M${meta.xScale(xA) + left},${meta.yScale(clampY(values[0])) + top}L${meta.xScale(xB) + left},${meta.yScale(clampY(values[1])) + top}L${meta.xScale(xB) + left},${meta.yScale(clampY(values[2])) + top}L${meta.xScale(xA) + left},${meta.yScale(clampY(values[3])) + top}Z`);
              }
              const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
              path.setAttribute("class", "graph-area-shading"); path.setAttribute("d", paths.join("")); path.setAttribute("fill", "#0e7490"); path.setAttribute("fill-opacity", "0.2"); path.setAttribute("pointer-events", "none"); group.appendChild(path);
            }
          } catch { /* Invalid regions are not shaded. */ }
          for (const item of labels.annotations) if (item.x >= Math.min(x0, x1) && item.x <= Math.max(x0, x1) && item.y >= Math.min(y0, y1) && item.y <= Math.max(y0, y1)) add(item.text, meta.xScale(item.x) + (meta.margin?.left ?? 0), meta.yScale(item.y) + (meta.margin?.top ?? 0) - 8);
          for (const expression of configRef.current.expressions) {
            if (!expression.visible) continue;
            try {
              for (const { datum, domain } of prepareGraphPieces(expression, configRef.current.parameters, library)) {
              if (!domain) continue;
              for (const [x, included] of [[domain.min, domain.includeMin], [domain.max, domain.includeMax]] as const) {
                const y = library.EvalBuiltIn(datum, "fn", { x });
                if (!Number.isFinite(y) || x < Math.min(x0, x1) || x > Math.max(x0, x1) || y < Math.min(y0, y1) || y > Math.max(y0, y1)) continue;
                const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                circle.setAttribute("class", "graph-domain-endpoint");
                circle.setAttribute("cx", String(meta.xScale(x) + left));
                circle.setAttribute("cy", String(meta.yScale(y) + top));
                circle.setAttribute("r", "4");
                circle.setAttribute("fill", included ? expression.color : "white");
                circle.setAttribute("stroke", expression.color);
                circle.setAttribute("stroke-width", "2");
                circle.setAttribute("pointer-events", "none");
                group.appendChild(circle);
              }
              }
            } catch { /* Invalid expressions and undefined endpoints have no marker. */ }
          }
          svg.appendChild(group);
        };

        const updateFunctionEmphasis = () => {
          const svg = target.querySelector("svg.function-plot");
          const meta = getChart()?.meta;
          if (!svg || !meta) return;
          // The interval sampler clamps off-screen samples to y=-1/height,
          // leaving a colored hairline along the plot boundary. Clip only the
          // curve paths slightly inside the viewport, not the axes or grid.
          const content = svg.querySelector(".content");
          const baseClip = content?.getAttribute("clip-path")?.match(/#([^)]*)/)?.[1];
          if (baseClip) {
            const clipId = `${baseClip}-curves`;
            let clip = svg.querySelector<SVGClipPathElement>(`[id="${clipId}"]`);
            if (!clip) {
              clip = document.createElementNS("http://www.w3.org/2000/svg", "clipPath");
              clip.id = clipId;
              clip.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "rect"));
              svg.querySelector("defs")?.appendChild(clip);
            }
            const rect = clip.querySelector("rect");
            if (rect) {
              rect.setAttribute("x", "0"); rect.setAttribute("y", "2");
              rect.setAttribute("width", String(meta.width ?? 0)); rect.setAttribute("height", String(Math.max(0, (meta.height ?? 0) - 4)));
            }
            svg.querySelectorAll<SVGPathElement>(".graph path.line").forEach((path) => path.setAttribute("clip-path", `url(#${clipId})`));
          }
          const expressionIds = configRef.current.expressions.filter((expression) => expression.visible).flatMap((expression) => {
            try { return prepareGraphPieces(expression, configRef.current.parameters, library).map(() => expression.id); }
            catch { return []; }
          });
          const groups = [...svg.querySelectorAll<SVGGElement>(".graph")];
          groups.slice(0, expressionIds.length).forEach((group, index) => {
            const selected = expressionIds[index] === configRef.current.selectedExpressionId;
            group.style.opacity = configRef.current.selectedExpressionId && !selected ? "0.62" : "1";
            group.querySelectorAll<SVGPathElement>("path.line").forEach((path) => { path.style.strokeWidth = selected ? "2.8px" : "2px"; });
          });
        };

  return { gridStep, updateGrid, updateLabels, updateFunctionEmphasis };
}

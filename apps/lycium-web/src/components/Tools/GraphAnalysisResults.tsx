import type { GraphExpression } from "./graphExpressions";
import type { Intercept, Intersection } from "./graphIntersections";

type Props = {
  expressions: readonly GraphExpression[];
  crossings: Intersection[] | null;
  intercepts: Intercept[] | null;
  onAddPoint: (x: number, y: number) => void;
};

export default function GraphAnalysisResults({ expressions, crossings, intercepts, onAddPoint }: Props) {
  return <>
    {crossings && <div role="status">{crossings.length === 0 ? <p className="graphing-hint">No crossings found in this view.</p> : <ul className="graph-crossings">{crossings.map((crossing, index) => <li key={`${crossing.first}-${crossing.second}-${index}`}><span>Functions {expressions.findIndex((item) => item.id === crossing.first) + 1} &amp; {expressions.findIndex((item) => item.id === crossing.second) + 1}: ({Number(crossing.x.toPrecision(6))}, {Number(crossing.y.toPrecision(6))})</span><button type="button" onClick={() => onAddPoint(crossing.x, crossing.y)} aria-label={`Add intersection ${index + 1} as point`}>Add point</button></li>)}</ul>}</div>}
    {intercepts && <div role="status">{intercepts.length === 0 ? <p className="graphing-hint">No intercepts found in this view.</p> : <ul className="graph-crossings">{intercepts.map((intercept, index) => <li key={`${intercept.curve}-${intercept.axis}-${index}`}><span>Function {expressions.findIndex((item) => item.id === intercept.curve) + 1}, {intercept.axis}-axis: ({Number(intercept.x.toPrecision(6))}, {Number(intercept.y.toPrecision(6))})</span><button type="button" onClick={() => onAddPoint(intercept.x, intercept.y)} aria-label={`Add intercept ${index + 1} as point`}>Add point</button></li>)}</ul>}</div>}
  </>;
}

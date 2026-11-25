"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { GraphCanvasHandle } from "./GraphCanvas";
import { graphExpressionCurve, type GraphExpression } from "./graphExpressions";
import { areaBetweenCurves, integrateCurve, tableOfValues, tangentAt } from "./graphCalculus";
import { findCrossings, findIntercepts, type Curve, type Intercept, type Intersection } from "./graphIntersections";
import type { GraphParameter } from "./graphParameters";

type Options = {
  expressions: GraphExpression[];
  parameters: GraphParameter[];
  parameterValues: Readonly<Record<string, number>>;
  selectedRowKey: string | null;
  errors: Record<string, string>;
  invalidDrafts: Record<string, boolean>;
  graphRef: RefObject<GraphCanvasHandle | null>;
};

export function useGraphAnalysis({ expressions, parameters, parameterValues, selectedRowKey, errors, invalidDrafts, graphRef }: Options) {
  const [crossings, setCrossings] = useState<Intersection[] | null>(null);
  const [intercepts, setIntercepts] = useState<Intercept[] | null>(null);
  const [crossingError, setCrossingError] = useState("");
  const [tangentX, setTangentX] = useState("0");
  const [tangent, setTangent] = useState<{ x: number; y: number; slope: number } | null>(null);
  const [tangentError, setTangentError] = useState("");
  const [tableStart, setTableStart] = useState("-2");
  const [tableStep, setTableStep] = useState("1");
  const [tableCount, setTableCount] = useState("5");
  const [values, setValues] = useState<{ x: number; y: number | null }[] | null>(null);
  const [tableError, setTableError] = useState("");
  const [integralStart, setIntegralStart] = useState("0");
  const [integralEnd, setIntegralEnd] = useState("1");
  const [areaStart, setAreaStart] = useState("0");
  const [areaEnd, setAreaEnd] = useState("1");
  const [integral, setIntegral] = useState<number | null>(null);
  const [integralError, setIntegralError] = useState("");
  const [areaSecond, setAreaSecond] = useState("");
  const [area, setArea] = useState<number | null>(null);
  const [areaError, setAreaError] = useState("");
  const areaRequest = useRef(0);
  const integralRequest = useRef(0);
  const areaFrame = useRef<number | null>(null);
  useEffect(() => () => { areaRequest.current++; if (areaFrame.current !== null) cancelAnimationFrame(areaFrame.current); }, []);
  useEffect(() => { setCrossings(null); setIntercepts(null); setCrossingError(""); }, [expressions, parameters]);
  useEffect(() => { setTangent(null); setTangentError(""); }, [expressions, parameters, selectedRowKey]);
  useEffect(() => { setValues(null); setTableError(""); }, [expressions, parameters, selectedRowKey]);
  useEffect(() => { integralRequest.current++; setIntegral(null); setIntegralError(""); }, [expressions, parameters, selectedRowKey]);
  useEffect(() => { areaRequest.current++; if (areaFrame.current !== null) cancelAnimationFrame(areaFrame.current); setArea(null); setAreaError(""); }, [expressions, parameters, selectedRowKey, areaSecond]);

  const areaRegion = useMemo(() => {
    const first = expressions.find((item) => `function:${item.id}` === selectedRowKey);
    const start = Number(areaStart), end = Number(areaEnd);
    return area !== null && first && areaStart.trim() && areaEnd.trim() && Number.isFinite(start) && Number.isFinite(end) ? { first: first.id, second: areaSecond, start, end } : null;
  }, [area, expressions, selectedRowKey, areaSecond, areaStart, areaEnd]);

  const moveAreaBound = (bound: "start" | "end", x: number) => {
    if (!areaRegion) return;
    const value = String(Number(x.toPrecision(6)));
    if (bound === "start") setAreaStart(value); else setAreaEnd(value);
    const first = expressions.find((item) => item.id === areaRegion.first), second = expressions.find((item) => item.id === areaRegion.second);
    if (!first || !second) return;
    const request = ++areaRequest.current;
    if (areaFrame.current !== null) cancelAnimationFrame(areaFrame.current);
    areaFrame.current = requestAnimationFrame(() => { areaFrame.current = null; void import("function-plot").then((library) => {
      if (request !== areaRequest.current) return;
      try {
        setArea(areaBetweenCurves(graphExpressionCurve(first, parameterValues, library), graphExpressionCurve(second, parameterValues, library), bound === "start" ? Number(value) : areaRegion.start, bound === "end" ? Number(value) : areaRegion.end));
        setAreaError("");
      } catch (error) { setAreaError(error instanceof Error ? error.message : "Unable to calculate the area."); }
    }).catch(() => { if (request === areaRequest.current) setAreaError("Unable to load the graph evaluator."); }); });
  };

  const calculateArea = async () => {
    const request = ++areaRequest.current;
    const first = expressions.find((item) => `function:${item.id}` === selectedRowKey);
    const second = expressions.find((item) => item.id === areaSecond);
    if (!first || !second || first.id === second.id || !first.visible || !second.visible || errors[first.id] || errors[second.id] || invalidDrafts[first.id] || invalidDrafts[second.id]) {
      setArea(null); setAreaError("Select two different valid functions."); return;
    }
    try {
      const library = await import("function-plot");
      if (request !== areaRequest.current) return;
      const number = (value: string) => value.trim() ? Number(value) : NaN;
      setArea(areaBetweenCurves(graphExpressionCurve(first, parameterValues, library), graphExpressionCurve(second, parameterValues, library), number(areaStart), number(areaEnd)));
      setAreaError("");
    } catch (error) { setArea(null); setAreaError(error instanceof Error ? error.message : "Unable to calculate the area."); }
  };

  const calculateIntegral = async () => {
    const request = ++integralRequest.current;
    const expression = expressions.find((item) => `function:${item.id}` === selectedRowKey);
    if (!expression || !expression.visible || errors[expression.id] || invalidDrafts[expression.id]) { setIntegral(null); setIntegralError("Select a valid function first."); return; }
    try {
      const library = await import("function-plot");
      if (request !== integralRequest.current) return;
      const number = (value: string) => value.trim() ? Number(value) : NaN;
      setIntegral(integrateCurve(graphExpressionCurve(expression, parameterValues, library), number(integralStart), number(integralEnd)));
      setIntegralError("");
    } catch (error) { setIntegral(null); setIntegralError(error instanceof Error ? error.message : "Unable to calculate the integral."); }
  };

  const generateValues = async () => {
    const expression = expressions.find((item) => `function:${item.id}` === selectedRowKey);
    if (!expression || !expression.visible || errors[expression.id] || invalidDrafts[expression.id]) { setValues(null); setTableError("Select a valid function first."); return; }
    try {
      const library = await import("function-plot");
      const number = (value: string) => value.trim() ? Number(value) : NaN;
      setValues(tableOfValues(graphExpressionCurve(expression, parameterValues, library), number(tableStart), number(tableStep), number(tableCount)));
      setTableError("");
    } catch (error) { setValues(null); setTableError(error instanceof Error ? error.message : "Unable to generate values."); }
  };

  const inspectTangent = async () => {
    const expression = expressions.find((item) => `function:${item.id}` === selectedRowKey);
    const x = tangentX.trim() ? Number(tangentX) : NaN;
    if (!expression || !expression.visible || errors[expression.id] || invalidDrafts[expression.id]) { setTangentError("Select a valid function first."); setTangent(null); return; }
    try {
      const library = await import("function-plot");
      setTangent(tangentAt(graphExpressionCurve(expression, parameterValues, library), x));
      setTangentError("");
    } catch (error) { setTangent(null); setTangentError(error instanceof Error ? error.message : "Unable to calculate the tangent."); }
  };

  const findIntersections = async (kind: "crossings" | "intercepts") => {
    const viewport = graphRef.current?.getViewport();
    const active = expressions.filter((expression) => expression.visible && expression.expr.trim() && !errors[expression.id] && !invalidDrafts[expression.id]);
    if (!viewport) { setCrossingError("The graph is still loading."); return; }
    if (active.length < (kind === "crossings" ? 2 : 1)) { setCrossingError(kind === "crossings" ? "Show at least two valid functions to find crossings." : "Show at least one valid function to find intercepts."); return; }
    if (active.length > 8) { setCrossingError("Show no more than eight functions at a time to find crossings."); return; }
    try {
      const library = await import("function-plot");
      const curves: Curve[] = active.map((expression) => {
        return graphExpressionCurve(expression, parameterValues, library);
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

  return { crossings, intercepts, crossingError, tangentX, setTangentX, tangent, setTangent, tangentError, tableStart, setTableStart, tableStep, setTableStep, tableCount, setTableCount, values, tableError, integralStart, setIntegralStart, integralEnd, setIntegralEnd, areaStart, setAreaStart, areaEnd, setAreaEnd, integral, setIntegral, integralError, setIntegralError, areaSecond, setAreaSecond, area, setArea, areaError, setAreaError, areaRequest, integralRequest, areaRegion, moveAreaBound, calculateArea, calculateIntegral, generateValues, inspectTangent, findIntersections };
}

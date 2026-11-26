import { describe, expect, it } from "vitest";
import { analyzeGraph, analyzeLinearDataset, createGraph, decodeGraphDocument, encodeGraphDocument, validateGraphExpression } from "./graphAgent";
import { handleGraphAgentRequest } from "./graphAgentHttp";

describe("graph agent interface", () => {
  it("validates supported explicit functions without executing user input", () => {
    expect(validateGraphExpression("y = sin(x)")).toEqual({ valid: true, expression: "sin(x)" });
    expect(validateGraphExpression("x=2")).toMatchObject({ valid: false });
  });
  it("analyzes a deterministic linear dataset", () => {
    const result = analyzeLinearDataset([{ x: "0", y: "1" }, { x: "1", y: "3" }, { x: "2", y: "5" }]);
    expect(result).toMatchObject({ slope: 2, intercept: 1 });
    if (result.ok) expect(result.rSquared).toBeCloseTo(1, 12);
  });
  it("creates a bounded editable document from agent input", () => {
    const result = createGraph({ expressions: ["y=x^2", "y=2*x+3"] });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.document.expressions.map(({ expr }) => expr)).toEqual(["x^2", "2*x+3"]);
  });
  it("returns numerical intersections through the shared analysis engine", () => {
    const result = analyzeGraph({ expressions: ["x^2", "4"], operation: "intersections", xDomain: [-5, 5] });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.result).toEqual(expect.arrayContaining([
      expect.objectContaining({ x: expect.closeTo(-2, 1e-5), y: expect.closeTo(4, 1e-5) }),
      expect.objectContaining({ x: expect.closeTo(2, 1e-5), y: expect.closeTo(4, 1e-5) }),
    ]));
  });
  it("round-trips a graph through an editable URL payload", () => {
    const created = createGraph({ expressions: ["x^2", "sin(x)"] });
    expect(created.ok).toBe(true);
    if (created.ok) expect(decodeGraphDocument(encodeGraphDocument(created.document))).toEqual(created.document);
  });
  it("rejects unsafe or unsupported agent expressions", () => {
    expect(createGraph({ expressions: ["x=2"] })).toMatchObject({ ok: false });
    expect(createGraph({ expressions: ["x;globalThis.alert(1)"] })).toMatchObject({ ok: false });
  });
  it("exposes a framework-neutral JSON HTTP contract", async () => {
    const response = await handleGraphAgentRequest(new Request("https://orvane.local/agent", { method: "POST", body: JSON.stringify({ operation: "create_graph", input: { expressions: ["x^2"] } }), headers: { "content-type": "application/json" } }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ apiVersion: "v1", ok: true, result: { document: { expressions: [{ expr: "x^2" }] } } });
  });
});

import { describe, expect, it } from "vitest";
import { parseGraphDocument } from "./graphDocument";

const example = { version: 1, expressions: [{ id: "1", expr: "a*x^2", color: "#176b55", visible: true }], parameters: [{ name: "a", value: 1, min: -5, max: 5, step: 0.1 }], viewport: { x: [-5, 5], y: [-3, 3] }, settings: { grid: true, precision: "auto", snapToGrid: false }, presentation: { interactiveParameters: ["a"] } };

describe("graph document", () => {
  it("round-trips portable graph state without retaining references", () => {
    const parsed = parseGraphDocument(JSON.parse(JSON.stringify(example)));
    expect(parsed).toEqual(example);
    parsed.viewport!.x[0] = -2;
    expect(example.viewport.x[0]).toBe(-5);
  });
  it("rejects unsupported versions, invalid bounds, duplicate ids and dangling controls", () => {
    const invalid = [
      { ...example, version: 2 },
      { ...example, viewport: { x: [2, -2], y: [0, 1] } },
      { ...example, expressions: [example.expressions[0], example.expressions[0]] },
      { ...example, parameters: [{ ...example.parameters[0], step: 0 }] },
      { ...example, presentation: { interactiveParameters: ["b"] } },
    ];
    for (const value of invalid) expect(() => parseGraphDocument(value)).toThrow();
  });
  it("preserves points and rejects invalid or duplicate point identifiers", () => {
    const point = { id: "p1", x: 2, y: -3, color: "#2563eb", visible: true };
    expect(parseGraphDocument({ ...example, points: [point] }).points).toEqual([point]);
    expect(() => parseGraphDocument({ ...example, points: [point, point] })).toThrow();
    expect(() => parseGraphDocument({ ...example, points: [{ ...point, x: Infinity }] })).toThrow();
    expect(parseGraphDocument(example).points).toBeUndefined();
  });
  it("round-trips datasets while rejecting invalid cells", () => {
    const dataset = { id: "d1", name: "Measurements", xLabel: "Time (s)", yLabel: "Mass (g)", color: "#c2410c", visible: true, regression: true, rows: [{ x: "1", y: "2" }, { x: "", y: "" }] };
    expect(parseGraphDocument({ ...example, datasets: [dataset] }).datasets).toEqual([dataset]);
    expect(parseGraphDocument({ ...example, datasets: [{ ...dataset, connected: true, fitType: "exponential" }] }).datasets?.[0]).toMatchObject({ connected: true, fitType: "exponential" });
    expect(() => parseGraphDocument({ ...example, datasets: [{ ...dataset, fitType: "other" }] })).toThrow();
    expect(() => parseGraphDocument({ ...example, datasets: [{ ...dataset, rows: [{ x: "1", y: "NaN" }] }] })).toThrow();
    expect(parseGraphDocument(example).datasets).toBeUndefined();
  });
  it("preserves scientific labels and annotations", () => {
    const labels = { title: "Kinetics", xTitle: "Time", xUnit: "s", yTitle: "Concentration", yUnit: "M", annotations: [{ id: "a", x: 2, y: 1, text: "Initial point" }] };
    expect(parseGraphDocument({ ...example, labels }).labels).toEqual(labels);
    expect(() => parseGraphDocument({ ...example, labels: { ...labels, annotations: [{ ...labels.annotations[0], x: Infinity }] } })).toThrow();
  });
});

import { describe, expect, it } from "vitest";
import { linearRegression, numericPoints, parseDatasetCsv } from "./graphDataset";

describe("datasets", () => {
  it("fits a line and calculates R² from measurements", () => {
    const fit = linearRegression([[0, 1], [1, 3], [2, 5]]);
    expect(fit?.slope).toBeCloseTo(2); expect(fit?.intercept).toBeCloseTo(1); expect(fit?.rSquared).toBeCloseTo(1);
    expect(linearRegression([[1, 2], [1, 3]])).toBeNull();
    expect(linearRegression([[0, 2], [1, 2]])?.rSquared).toBe(1);
  });
  it("only plots complete finite rows", () => {
    expect(numericPoints([{ x: "", y: "1" }, { x: "2", y: "3" }, { x: "x", y: "4" }])).toEqual([[2, 3]]);
  });
  it("imports two-column CSV with quoted headers", () => {
    expect(parseDatasetCsv('"Time, s",Concentration\r\n0,1\r\n10,0.78\r\n')).toEqual({ xLabel: "Time, s", yLabel: "Concentration", rows: [{ x: "0", y: "1" }, { x: "10", y: "0.78" }] });
    expect(() => parseDatasetCsv("x,y\n1,nope")).toThrow();
    expect(() => parseDatasetCsv('"bad,header\n1,2')).toThrow();
  });
});

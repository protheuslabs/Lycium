import { describe, expect, it } from "vitest";
import { elements, getElement, parseFormula } from "./index";

describe("chemistry core", () => {
  it("contains every element exactly once in atomic-number order", () => {
    expect(elements).toHaveLength(118);
    expect(elements.map(element => element.atomicNumber)).toEqual(Array.from({ length: 118 }, (_, index) => index + 1));
    expect(new Set(elements.map(element => element.symbol)).size).toBe(118);
  });

  it("retains conventional table positions and detached series", () => {
    expect(getElement("H")).toMatchObject({ period: 1, group: 1, row: 1, column: 1 });
    expect(getElement("He")).toMatchObject({ period: 1, group: 18, row: 1, column: 18 });
    expect(getElement("Fe")).toMatchObject({ period: 4, group: 8 });
    expect(getElement("Ce")).toMatchObject({ period: 6, series: "lanthanide", row: 9, column: 3 });
    expect(getElement("Lr")).toMatchObject({ period: 7, series: "actinide", row: 10, column: 16 });
  });

  it("represents intervals, standard weights, and reference isotopes distinctly", () => {
    expect(getElement("O")?.atomicWeight.kind).toBe("interval");
    expect(getElement("Fe")?.atomicWeight.kind).toBe("standard");
    expect(getElement("Tc")?.atomicWeight.kind).toBe("reference-isotope");
  });

  it("parses nested groups and hydrates for molar-mass work", () => {
    expect(Object.fromEntries(parseFormula("Ca(OH)2").counts)).toEqual({ Ca: 1, O: 2, H: 2 });
    expect(Object.fromEntries(parseFormula("Al2(SO4)3").counts)).toEqual({ Al: 2, S: 3, O: 12 });
    expect(Object.fromEntries(parseFormula("CuSO4·5H2O").counts)).toEqual({ Cu: 1, S: 1, O: 9, H: 10 });
    expect(parseFormula("H2O").molarMass).toBeCloseTo(18.015, 2);
  });
});

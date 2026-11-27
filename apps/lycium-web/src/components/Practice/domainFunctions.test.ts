import { describe, expect, it } from "vitest";
import { callDomainFunction } from "./domainFunctions";

describe("practice domain functions", () => {
  it("calculates molar masses without exercise-specific constants", () => {
    expect(callDomainFunction("chemistry.molarMass", ["H2O"])).toBeCloseTo(18.015, 3);
    expect(callDomainFunction("chemistry.molarMass", ["CaCO3"])).toBeCloseTo(100.086, 3);
  });

  it("exposes safe reusable mathematics", () => {
    expect(callDomainFunction("math.pow", [3, 4])).toBe(81);
    expect(callDomainFunction("math.sqrt", [81])).toBe(9);
  });

  it("rejects unknown functions and formulas", () => {
    expect(() => callDomainFunction("system.eval", ["1 + 1"])).toThrow("Unknown domain function");
    expect(() => callDomainFunction("chemistry.molarMass", ["Xx2"])).toThrow("Unknown element");
  });
});

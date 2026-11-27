import { describe, expect, it } from "vitest";
import { atomElectronStatus, molecularFormula, molarMass } from "./moleculeChemistry";
import { moleculesEquivalent } from "./moleculeComparison";
import { MOLECULE_EXAMPLES, parseMoleculeDocument } from "./moleculeModel";

describe("molecule documents", () => {
  it("calculates formulas and molar masses from explicit atoms", () => {
    expect(molecularFormula(MOLECULE_EXAMPLES.water)).toBe("H2O");
    expect(molarMass(MOLECULE_EXAMPLES.water)).toBeCloseTo(18.015, 3);
    expect(molecularFormula(MOLECULE_EXAMPLES.methanol)).toBe("CH4O");
    expect(molarMass(MOLECULE_EXAMPLES.carbonDioxide)).toBeCloseTo(44.009, 3);
  });

  it("preserves lone pairs and charges through serialization", () => {
    const restored = parseMoleculeDocument(JSON.parse(JSON.stringify(MOLECULE_EXAMPLES.ammonium)));
    expect(restored).toEqual(MOLECULE_EXAMPLES.ammonium);
    expect(restored.atoms.find(atom => atom.element === "N")?.formalCharge).toBe(1);
    expect(MOLECULE_EXAMPLES.water.atoms.find(atom => atom.element === "O")?.lonePairs).toBe(2);
  });

  it("compares chemical graphs independently of coordinates, IDs, and insertion order", () => {
    const water = MOLECULE_EXAMPLES.water;
    const rearranged = {
      version: 1 as const,
      atoms: [
        { ...water.atoms[2], id: "right", x: 900, y: -400 },
        { ...water.atoms[0], id: "center", x: -210, y: 80 },
        { ...water.atoms[1], id: "left", x: 10, y: 10 },
      ],
      bonds: [
        { id: "x", source: "center", target: "right", order: 1 as const },
        { id: "y", source: "left", target: "center", order: 1 as const },
      ],
    };
    expect(moleculesEquivalent(water, rearranged)).toBe(true);
    expect(moleculesEquivalent(water, { ...rearranged, atoms: rearranged.atoms.map(atom => atom.element === "O" ? { ...atom, lonePairs: 1 } : atom) })).toBe(false);
  });

  it("reports electron-count consistency without preventing invalid structures", () => {
    const oxygen = MOLECULE_EXAMPLES.water.atoms.find(atom => atom.element === "O")!;
    expect(atomElectronStatus(MOLECULE_EXAMPLES.water, oxygen).valid).toBe(true);
    expect(atomElectronStatus({ ...MOLECULE_EXAMPLES.water, bonds: [] }, oxygen).valid).toBe(false);
  });
});

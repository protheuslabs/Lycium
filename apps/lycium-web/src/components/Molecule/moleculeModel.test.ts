import { describe, expect, it } from "vitest";
import { atomElectronStatus, molecularFormula, molarMass } from "./moleculeChemistry";
import { moleculesEquivalent } from "./moleculeComparison";
import { connectedAtomIds, MOLECULE_EXAMPLES, parseMoleculeDocument } from "./moleculeModel";

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

  it("finds complete connected components for molecule dragging", () => {
    expect(connectedAtomIds(MOLECULE_EXAMPLES.water, "o").sort()).toEqual(["h1", "h2", "o"]);
    const separate = { ...MOLECULE_EXAMPLES.water, atoms: [...MOLECULE_EXAMPLES.water.atoms, { id: "free", element: "C", x: 200, y: 200, formalCharge: 0, lonePairs: 0 }] };
    expect(connectedAtomIds(separate, "free")).toEqual(["free"]);
  });

  it("rejects unknown elements, duplicate bond IDs, and duplicate atom pairs", () => {
    expect(() => parseMoleculeDocument({ version: 1, atoms: [{ id: "x", element: "Xx", x: 0, y: 0, formalCharge: 0, lonePairs: 0 }], bonds: [] })).toThrow("Invalid atom");
    const water = JSON.parse(JSON.stringify(MOLECULE_EXAMPLES.water));
    water.bonds[1].id = water.bonds[0].id;
    expect(() => parseMoleculeDocument(water)).toThrow("Bond IDs must be unique");
    const duplicatePair = JSON.parse(JSON.stringify(MOLECULE_EXAMPLES.water));
    duplicatePair.bonds.push({ id: "extra", source: "h1", target: "o", order: 2 });
    expect(() => parseMoleculeDocument(duplicatePair)).toThrow("Only one bond");
  });

  it("supports introductory incomplete and expanded-octet structures without overclaiming", () => {
    const bf3 = {
      version: 1 as const,
      atoms: [
        { id: "b", element: "B", x: 0, y: 0, formalCharge: 0, lonePairs: 0 },
        ...[1, 2, 3].map(index => ({ id: `f${index}`, element: "F", x: index * 50, y: 50, formalCharge: 0, lonePairs: 3 })),
      ],
      bonds: [1, 2, 3].map(index => ({ id: `b${index}`, source: "b", target: `f${index}`, order: 1 as const })),
    };
    expect(bf3.atoms.map(atom => atomElectronStatus(bf3, atom).status)).toEqual(["consistent", "consistent", "consistent", "consistent"]);
    const pcl5 = {
      version: 1 as const,
      atoms: [{ id: "p", element: "P", x: 0, y: 0, formalCharge: 0, lonePairs: 0 }, ...[1, 2, 3, 4, 5].map(index => ({ id: `c${index}`, element: "Cl", x: index, y: index, formalCharge: 0, lonePairs: 3 }))],
      bonds: [1, 2, 3, 4, 5].map(index => ({ id: `p${index}`, source: "p", target: `c${index}`, order: 1 as const })),
    };
    expect(atomElectronStatus(pcl5, pcl5.atoms[0]).status).toBe("consistent");
    const nitricOxide = { version: 1 as const, atoms: [{ id: "n", element: "N", x: 0, y: 0, formalCharge: 0, lonePairs: 1 }, { id: "o", element: "O", x: 80, y: 0, formalCharge: 0, lonePairs: 2 }], bonds: [{ id: "b", source: "n", target: "o", order: 2 as const }] };
    expect(atomElectronStatus(nitricOxide, nitricOxide.atoms[0]).status).toBe("unsupported");
  });
});

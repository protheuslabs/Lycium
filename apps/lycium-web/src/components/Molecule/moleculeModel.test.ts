import { describe, expect, it } from "vitest";
import { atomBondAvailability, atomBondCapacity, canSetBondOrder, defaultLonePairs, atomElectronStatus, molecularFormula, molarMass } from "./moleculeChemistry";
import { moleculesEquivalent } from "./moleculeComparison";
import { cleanMoleculeLayout, connectedAtomIds, insertCarbonRing, MOLECULE_EXAMPLES, parseMoleculeDocument, resolveMoleculeAssistance } from "./moleculeModel";
import { atomVisual, lonePairPositions } from "./moleculeAppearance";
import { preferredBondLength, snapBondPosition } from "./moleculeGeometry";

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

  it("enforces available atom connections using bond order", () => {
    expect(defaultLonePairs("O")).toBe(2);
    expect(defaultLonePairs("Cl")).toBe(3);
    expect(atomBondCapacity({ id: "h", element: "H", x: 0, y: 0, formalCharge: 0, lonePairs: 0 })).toBe(1);
    expect(atomBondCapacity({ id: "c", element: "C", x: 0, y: 0, formalCharge: 0, lonePairs: 0 })).toBe(4);
    expect(atomBondCapacity({ id: "o", element: "O", x: 0, y: 0, formalCharge: 0, lonePairs: 2 })).toBe(2);
    const water = MOLECULE_EXAMPLES.water;
    expect(canSetBondOrder(water, "o", "h1", 1, "b1")).toBe(true);
    expect(canSetBondOrder(water, "o", "h1", 2, "b1")).toBe(false);
    expect(canSetBondOrder(water, "h1", "h2", 1)).toBe(false);
    const carbonDioxide = MOLECULE_EXAMPLES.carbonDioxide;
    expect(atomBondAvailability(carbonDioxide, carbonDioxide.atoms.find(atom => atom.id === "c")!)).toEqual({ total: 4, used: 4, available: 0 });
    expect(atomBondAvailability(carbonDioxide, carbonDioxide.atoms.find(atom => atom.id === "o1")!)).toEqual({ total: 2, used: 2, available: 0 });
    expect(canSetBondOrder(carbonDioxide, "c", "o1", 3, "b1")).toBe(false);
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

  it("compresses covalent radii and keeps lone pairs away from bonds", () => {
    expect(atomVisual("H", "model").radius).toBeLessThan(atomVisual("O", "model").radius);
    expect(atomVisual("O", "model").radius).toBeLessThan(atomVisual("Cl", "model").radius);
    const oxygen = MOLECULE_EXAMPLES.water.atoms[0];
    const positions = lonePairPositions(MOLECULE_EXAMPLES.water, oxygen, atomVisual("O", "model").radius);
    expect(positions).toHaveLength(2);
    expect(positions.every(position => position.y < 0)).toBe(true);
  });

  it("inserts reusable carbon-ring and alternating carbon fragments", () => {
    const cyclopentane = insertCarbonRing({ version: 1, atoms: [], bonds: [] }, 5);
    expect(cyclopentane.document.atoms).toHaveLength(5);
    expect(cyclopentane.document.bonds).toHaveLength(5);
    expect(cyclopentane.document.bonds.every(bond => bond.order === 1)).toBe(true);
    const benzene = insertCarbonRing({ version: 1, atoms: [], bonds: [] }, 6, true);
    expect(benzene.document.bonds.map(bond => bond.order)).toEqual([2, 1, 2, 1, 2, 1]);
  });

  it("cleans uneven bonded layouts while preserving the structure center", () => {
    const uneven = {
      ...MOLECULE_EXAMPLES.water,
      atoms: MOLECULE_EXAMPLES.water.atoms.map((atom, index) => ({ ...atom, x: [10, -15, 310][index], y: [20, 35, 70][index] })),
    };
    const center = (document: typeof uneven) => ({
      x: document.atoms.reduce((sum, atom) => sum + atom.x, 0) / document.atoms.length,
      y: document.atoms.reduce((sum, atom) => sum + atom.y, 0) / document.atoms.length,
    });
    const bondError = (document: typeof uneven) => document.bonds.reduce((sum, bond) => {
      const source = document.atoms.find(atom => atom.id === bond.source)!;
      const target = document.atoms.find(atom => atom.id === bond.target)!;
      return sum + Math.abs(Math.hypot(target.x - source.x, target.y - source.y) - preferredBondLength(source.element, target.element));
    }, 0);
    const cleaned = cleanMoleculeLayout(uneven);
    expect(bondError(cleaned)).toBeLessThan(bondError(uneven));
    expect(center(cleaned).x).toBeCloseTo(center(uneven).x, 8);
    expect(center(cleaned).y).toBeCloseTo(center(uneven).y, 8);
    expect(cleaned.bonds).toEqual(uneven.bonds);
  });

  it("snaps new bonds to standard lengths and useful molecular angles", () => {
    const carbon = { version: 1 as const, atoms: [{ id: "c", element: "C", x: 0, y: 0, formalCharge: 0, lonePairs: 0 }], bonds: [] };
    const horizontal = snapBondPosition(carbon, "c", { x: 143, y: 8 }, "H");
    expect(Math.hypot(horizontal.x, horizontal.y)).toBeCloseTo(preferredBondLength("C", "H"), 8);
    expect(horizontal.y).toBeCloseTo(0, 8);
    const withNeighbor = {
      version: 1 as const,
      atoms: [...carbon.atoms, { id: "h", element: "H", x: 100, y: 0, formalCharge: 0, lonePairs: 0 }],
      bonds: [{ id: "b", source: "c", target: "h", order: 1 as const }],
    };
    const angled = snapBondPosition(withNeighbor, "c", { x: -35, y: 90 }, "H");
    const angle = Math.atan2(angled.y, angled.x) * 180 / Math.PI;
    expect(angle).toBeCloseTo(109.5, 8);
    expect(snapBondPosition(withNeighbor, "c", { x: 37, y: 83 }, "H", { lengths: false, angles: false })).toEqual({ x: 37, y: 83 });
  });

  it("keeps chemistry assistance configurable by learning context", () => {
    expect(resolveMoleculeAssistance("standalone", "guided")).toMatchObject({ initializeLonePairs: true, enforceValenceCapacity: true, showValenceWarnings: true });
    expect(resolveMoleculeAssistance("embedded", "independent")).toMatchObject({ initializeLonePairs: false, enforceValenceCapacity: false, showValenceWarnings: true });
    expect(resolveMoleculeAssistance("assessment")).toEqual({ initializeLonePairs: false, enforceValenceCapacity: false, showValenceWarnings: false, snapBondLengths: false, snapBondAngles: false, autoCleanLayout: false });
    expect(resolveMoleculeAssistance("assessment", { showValenceWarnings: true })).toMatchObject({ initializeLonePairs: false, enforceValenceCapacity: false, showValenceWarnings: true });
  });
});

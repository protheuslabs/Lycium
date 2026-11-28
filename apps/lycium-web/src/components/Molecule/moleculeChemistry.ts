import type { MoleculeAtom, MoleculeDocument } from "./moleculeModel";
import { getElement } from "../../chemistry-core";

const VALENCE_ELECTRONS: Record<string, number> = { H: 1, B: 3, C: 4, N: 5, O: 6, F: 7, P: 5, S: 6, Cl: 7, Br: 7, I: 7, Si: 4 };
const ALLOWED_SHELLS: Record<string, number[]> = { H: [2], B: [6, 8], C: [8], N: [8], O: [8], F: [8], Si: [8], P: [8, 10], S: [8, 10, 12], Cl: [8], Br: [8], I: [8] };
export type ElectronValidationStatus = "consistent" | "inconsistent" | "unsupported";

export function molecularFormula(document: MoleculeDocument) {
  const counts = new Map<string, number>();
  document.atoms.forEach(({ element }) => counts.set(element, (counts.get(element) ?? 0) + 1));
  const ordered = [...counts.keys()].sort((a, b) => a === "C" ? -1 : b === "C" ? 1 : a === "H" ? -1 : b === "H" ? 1 : a.localeCompare(b));
  return ordered.map(element => `${element}${counts.get(element) === 1 ? "" : counts.get(element)}`).join("") || "—";
}

export function molarMass(document: MoleculeDocument) {
  return document.atoms.reduce((total, { element }) => total + (getElement(element)?.atomicWeight.value ?? 0), 0);
}

export function atomElectronStatus(document: MoleculeDocument, atom: MoleculeAtom) {
  const bondOrder = document.bonds.filter(bond => bond.source === atom.id || bond.target === atom.id).reduce((sum, bond) => sum + bond.order, 0);
  const valence = VALENCE_ELECTRONS[atom.element];
  if (valence === undefined) return { status: "unsupported" as const, valid: null, message: `Lewis electron validation is not available for ${atom.element} yet.` };
  const totalValence = document.atoms.reduce((sum, item) => sum + (VALENCE_ELECTRONS[item.element] ?? 0), 0) - document.atoms.reduce((sum, item) => sum + item.formalCharge, 0);
  if (totalValence % 2 !== 0) return { status: "unsupported" as const, valid: null, message: "Odd-electron and radical structures are not validated yet." };
  const calculatedCharge = valence - (atom.lonePairs * 2 + bondOrder);
  const shellElectrons = atom.lonePairs * 2 + bondOrder * 2;
  const allowedShells = ALLOWED_SHELLS[atom.element];
  if (!allowedShells) return { status: "unsupported" as const, valid: null, message: `Lewis electron validation is not available for ${atom.element} yet.` };
  const valid = calculatedCharge === atom.formalCharge && allowedShells.includes(shellElectrons);
  return { status: (valid ? "consistent" : "inconsistent") as ElectronValidationStatus, valid, message: valid ? "Electron count is consistent." : `Check ${atom.element}: expected charge ${calculatedCharge >= 0 ? "+" : ""}${calculatedCharge}; shell has ${shellElectrons} electrons (supported: ${allowedShells.join(" or ")}).` };
}

export function moleculeWarnings(document: MoleculeDocument) {
  return document.atoms.map(atom => ({ atom, ...atomElectronStatus(document, atom) })).filter(item => item.status !== "consistent");
}

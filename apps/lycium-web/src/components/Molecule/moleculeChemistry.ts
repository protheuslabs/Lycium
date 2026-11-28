import type { MoleculeAtom, MoleculeDocument } from "./moleculeModel";
import { getElement } from "../../chemistry-core";

const VALENCE_ELECTRONS: Record<string, number> = { H: 1, B: 3, C: 4, N: 5, O: 6, F: 7, P: 5, S: 6, Cl: 7, Br: 7, I: 7, Si: 4 };
const ALLOWED_SHELLS: Record<string, number[]> = { H: [2], B: [6, 8], C: [8], N: [8], O: [8], F: [8], Si: [8], P: [8, 10], S: [8, 10, 12], Cl: [8], Br: [8], I: [8] };
const DEFAULT_LONE_PAIRS: Record<string, number> = { H: 0, B: 0, C: 0, N: 1, O: 2, F: 3, Si: 0, P: 1, S: 2, Cl: 3, Br: 3, I: 3 };
export type ElectronValidationStatus = "consistent" | "inconsistent" | "unsupported";

export function defaultLonePairs(element: string) {
  return DEFAULT_LONE_PAIRS[element] ?? 0;
}

export function atomBondOrder(document: MoleculeDocument, atomId: string, excludedBondId?: string) {
  return document.bonds
    .filter(bond => bond.id !== excludedBondId && (bond.source === atomId || bond.target === atomId))
    .reduce((sum, bond) => sum + bond.order, 0);
}

export function atomBondCapacity(atom: MoleculeAtom) {
  const valence = VALENCE_ELECTRONS[atom.element];
  const shells = ALLOWED_SHELLS[atom.element];
  if (valence === undefined || !shells) return null;
  const formalChargeCapacity = valence - atom.formalCharge - atom.lonePairs * 2;
  const shellCapacity = Math.max(...shells) / 2 - atom.lonePairs;
  return Math.max(0, Math.min(formalChargeCapacity, shellCapacity));
}

export function canSetBondOrder(document: MoleculeDocument, sourceId: string, targetId: string, order: 1 | 2 | 3, existingBondId?: string) {
  if (sourceId === targetId) return false;
  const source = document.atoms.find(atom => atom.id === sourceId);
  const target = document.atoms.find(atom => atom.id === targetId);
  if (!source || !target) return false;
  const sourceCapacity = atomBondCapacity(source);
  const targetCapacity = atomBondCapacity(target);
  return (sourceCapacity === null || atomBondOrder(document, sourceId, existingBondId) + order <= sourceCapacity)
    && (targetCapacity === null || atomBondOrder(document, targetId, existingBondId) + order <= targetCapacity);
}

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
  const bondOrder = atomBondOrder(document, atom.id);
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

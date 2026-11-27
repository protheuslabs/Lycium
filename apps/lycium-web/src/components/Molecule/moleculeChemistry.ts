import type { MoleculeAtom, MoleculeDocument } from "./moleculeModel";
import { getElement } from "../../chemistry-core";

const VALENCE_ELECTRONS: Record<string, number> = { H: 1, B: 3, C: 4, N: 5, O: 6, F: 7, P: 5, S: 6, Cl: 7, Br: 7, I: 7, Si: 4 };

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
  if (valence === undefined) return { valid: false, message: "Lewis electron validation is not available for this element yet." };
  const calculatedCharge = valence - (atom.lonePairs * 2 + bondOrder);
  const shellElectrons = atom.lonePairs * 2 + bondOrder * 2;
  const target = atom.element === "H" ? 2 : 8;
  const valid = calculatedCharge === atom.formalCharge && shellElectrons === target;
  return { valid, message: valid ? "Electron count is consistent." : `Check ${atom.element}: expected charge ${calculatedCharge >= 0 ? "+" : ""}${calculatedCharge} from its bonds and lone pairs; shell has ${shellElectrons}/${target} electrons.` };
}

export function moleculeWarnings(document: MoleculeDocument) {
  return document.atoms.map(atom => ({ atom, ...atomElectronStatus(document, atom) })).filter(item => !item.valid);
}

export type BondOrder = 1 | 2 | 3;
export type MoleculeAtom = { id: string; element: string; formalCharge: number; lonePairs: number; x: number; y: number };
export type MoleculeBond = { id: string; source: string; target: string; order: BondOrder };
export type MoleculeDocument = { version: 1; atoms: MoleculeAtom[]; bonds: MoleculeBond[] };

export type MoleculeWorkspaceMode = "standalone" | "embedded" | "readonly" | "assessment";
export type MoleculeWorkspaceConfig = {
  mode?: MoleculeWorkspaceMode;
  initialDocument?: MoleculeDocument;
  allowedElements?: string[];
  allowedBondOrders?: BondOrder[];
  allowCharges?: boolean;
  allowLonePairs?: boolean;
  allowImportExport?: boolean;
  allowTemplates?: boolean;
  showProperties?: boolean;
};

export const EMPTY_MOLECULE: MoleculeDocument = { version: 1, atoms: [], bonds: [] };

const atom = (id: string, element: string, x: number, y: number, formalCharge = 0, lonePairs = 0): MoleculeAtom =>
  ({ id, element, x, y, formalCharge, lonePairs });
const bond = (id: string, source: string, target: string, order: BondOrder = 1): MoleculeBond => ({ id, source, target, order });

export const MOLECULE_EXAMPLES: Record<string, MoleculeDocument> = {
  water: { version: 1, atoms: [atom("o", "O", 0, 0, 0, 2), atom("h1", "H", -80, 45), atom("h2", "H", 80, 45)], bonds: [bond("b1", "o", "h1"), bond("b2", "o", "h2")] },
  carbonDioxide: { version: 1, atoms: [atom("o1", "O", -95, 0, 0, 2), atom("c", "C", 0, 0), atom("o2", "O", 95, 0, 0, 2)], bonds: [bond("b1", "o1", "c", 2), bond("b2", "c", "o2", 2)] },
  methane: { version: 1, atoms: [atom("c", "C", 0, 0), atom("h1", "H", 0, -85), atom("h2", "H", 85, 0), atom("h3", "H", 0, 85), atom("h4", "H", -85, 0)], bonds: [bond("b1", "c", "h1"), bond("b2", "c", "h2"), bond("b3", "c", "h3"), bond("b4", "c", "h4")] },
  ammonia: { version: 1, atoms: [atom("n", "N", 0, 0, 0, 1), atom("h1", "H", 0, -85), atom("h2", "H", 80, 55), atom("h3", "H", -80, 55)], bonds: [bond("b1", "n", "h1"), bond("b2", "n", "h2"), bond("b3", "n", "h3")] },
  ammonium: { version: 1, atoms: [atom("n", "N", 0, 0, 1), atom("h1", "H", 0, -85), atom("h2", "H", 85, 0), atom("h3", "H", 0, 85), atom("h4", "H", -85, 0)], bonds: [bond("b1", "n", "h1"), bond("b2", "n", "h2"), bond("b3", "n", "h3"), bond("b4", "n", "h4")] },
  methanol: { version: 1, atoms: [atom("c", "C", -45, 0), atom("o", "O", 55, 0, 0, 2), atom("h1", "H", -95, -70), atom("h2", "H", -95, 70), atom("h3", "H", -45, 90), atom("h4", "H", 130, 0)], bonds: [bond("b1", "c", "o"), bond("b2", "c", "h1"), bond("b3", "c", "h2"), bond("b4", "c", "h3"), bond("b5", "o", "h4")] },
  ethene: { version: 1, atoms: [atom("c1", "C", -50, 0), atom("c2", "C", 50, 0), atom("h1", "H", -105, -70), atom("h2", "H", -105, 70), atom("h3", "H", 105, -70), atom("h4", "H", 105, 70)], bonds: [bond("b1", "c1", "c2", 2), bond("b2", "c1", "h1"), bond("b3", "c1", "h2"), bond("b4", "c2", "h3"), bond("b5", "c2", "h4")] },
};

export function connectedAtomIds(document: MoleculeDocument, startId: string) {
  if (!document.atoms.some(atom => atom.id === startId)) return [];
  const connected = new Set([startId]);
  const queue = [startId];
  while (queue.length) {
    const current = queue.shift()!;
    document.bonds.forEach(bond => {
      const neighbor = bond.source === current ? bond.target : bond.target === current ? bond.source : null;
      if (neighbor && !connected.has(neighbor)) { connected.add(neighbor); queue.push(neighbor); }
    });
  }
  return [...connected];
}

function nextNumericId(prefix: string, ids: string[]) {
  const next = ids.reduce((maximum, id) => Math.max(maximum, Number(id.replace(/\D/g, "")) || 0), 0) + 1;
  return `${prefix}${next}`;
}

export function insertCarbonRing(document: MoleculeDocument, size: 3 | 4 | 5 | 6, alternating = false) {
  const centerX = document.atoms.length ? Math.max(...document.atoms.map(atom => atom.x)) + 155 : 0;
  const centerY = document.atoms.length ? document.atoms.reduce((sum, atom) => sum + atom.y, 0) / document.atoms.length : 0;
  const radius = size === 3 ? 66 : size === 4 ? 72 : 78;
  const atoms = [...document.atoms], bonds = [...document.bonds], addedAtomIds: string[] = [];
  for (let index = 0; index < size; index += 1) {
    const id = nextNumericId("a", atoms.map(atom => atom.id));
    const angle = -Math.PI / 2 + index * Math.PI * 2 / size;
    atoms.push({ id, element: "C", formalCharge: 0, lonePairs: 0, x: centerX + Math.cos(angle) * radius, y: centerY + Math.sin(angle) * radius });
    addedAtomIds.push(id);
  }
  addedAtomIds.forEach((source, index) => {
    const target = addedAtomIds[(index + 1) % addedAtomIds.length];
    bonds.push({ id: nextNumericId("b", bonds.map(bond => bond.id)), source, target, order: alternating && index % 2 === 0 ? 2 : 1 });
  });
  return { document: { version: 1 as const, atoms, bonds }, addedAtomIds };
}

export function cleanMoleculeLayout(document: MoleculeDocument) {
  if (document.atoms.length < 2) return document;
  const positions = new Map(document.atoms.map(atom => [atom.id, { x: atom.x, y: atom.y }]));
  const originalCenter = {
    x: document.atoms.reduce((sum, atom) => sum + atom.x, 0) / document.atoms.length,
    y: document.atoms.reduce((sum, atom) => sum + atom.y, 0) / document.atoms.length,
  };
  for (let iteration = 0; iteration < 100; iteration += 1) {
    const forces = new Map(document.atoms.map(atom => [atom.id, { x: 0, y: 0 }]));
    document.bonds.forEach(bond => {
      const source = positions.get(bond.source)!, target = positions.get(bond.target)!;
      const dx = target.x - source.x, dy = target.y - source.y, distance = Math.max(1, Math.hypot(dx, dy));
      const sourceAtom = document.atoms.find(atom => atom.id === bond.source)!, targetAtom = document.atoms.find(atom => atom.id === bond.target)!;
      const force = (distance - preferredBondLength(sourceAtom.element, targetAtom.element)) * .075, fx = dx / distance * force, fy = dy / distance * force;
      forces.get(bond.source)!.x += fx; forces.get(bond.source)!.y += fy;
      forces.get(bond.target)!.x -= fx; forces.get(bond.target)!.y -= fy;
    });
    for (let left = 0; left < document.atoms.length; left += 1) for (let right = left + 1; right < document.atoms.length; right += 1) {
      const a = positions.get(document.atoms[left].id)!, b = positions.get(document.atoms[right].id)!;
      const dx = b.x - a.x, dy = b.y - a.y, distance = Math.max(1, Math.hypot(dx, dy));
      if (distance >= 72) continue;
      const force = (72 - distance) * .055, fx = dx / distance * force, fy = dy / distance * force;
      forces.get(document.atoms[left].id)!.x -= fx; forces.get(document.atoms[left].id)!.y -= fy;
      forces.get(document.atoms[right].id)!.x += fx; forces.get(document.atoms[right].id)!.y += fy;
    }
    document.atoms.forEach(atom => {
      const position = positions.get(atom.id)!, force = forces.get(atom.id)!;
      position.x += Math.max(-7, Math.min(7, force.x)); position.y += Math.max(-7, Math.min(7, force.y));
    });
  }
  const center = {
    x: [...positions.values()].reduce((sum, position) => sum + position.x, 0) / positions.size,
    y: [...positions.values()].reduce((sum, position) => sum + position.y, 0) / positions.size,
  };
  return { ...document, atoms: document.atoms.map(atom => ({ ...atom, x: positions.get(atom.id)!.x - center.x + originalCenter.x, y: positions.get(atom.id)!.y - center.y + originalCenter.y })) };
}

export function parseMoleculeDocument(value: unknown): MoleculeDocument {
  if (!value || typeof value !== "object" || (value as { version?: unknown }).version !== 1) throw new Error("Unsupported molecule document.");
  const candidate = value as { atoms?: unknown; bonds?: unknown };
  if (!Array.isArray(candidate.atoms) || !Array.isArray(candidate.bonds)) throw new Error("Molecule atoms and bonds must be arrays.");
  const atoms = candidate.atoms.map(item => {
    if (!item || typeof item !== "object") throw new Error("Invalid atom.");
    const entry = item as Partial<MoleculeAtom>;
    if (typeof entry.id !== "string" || !/^[A-Z][a-z]?$/.test(String(entry.element)) || !getElement(String(entry.element)) || !Number.isFinite(entry.x) || !Number.isFinite(entry.y) ||
      !Number.isInteger(entry.formalCharge) || !Number.isInteger(entry.lonePairs) || entry.lonePairs! < 0 || entry.lonePairs! > 4) throw new Error("Invalid atom.");
    return entry as MoleculeAtom;
  });
  const ids = new Set(atoms.map(item => item.id));
  if (ids.size !== atoms.length) throw new Error("Atom IDs must be unique.");
  const bonds = candidate.bonds.map(item => {
    if (!item || typeof item !== "object") throw new Error("Invalid bond.");
    const entry = item as Partial<MoleculeBond>;
    if (typeof entry.id !== "string" || typeof entry.source !== "string" || typeof entry.target !== "string" || entry.source === entry.target ||
      !ids.has(entry.source) || !ids.has(entry.target) || ![1, 2, 3].includes(entry.order as number)) throw new Error("Invalid bond.");
    return entry as MoleculeBond;
  });
  const bondIds = new Set(bonds.map(item => item.id));
  if (bondIds.size !== bonds.length) throw new Error("Bond IDs must be unique.");
  const pairs = new Set<string>();
  bonds.forEach(bond => {
    const pair = [bond.source, bond.target].sort().join(":");
    if (pairs.has(pair)) throw new Error("Only one bond may connect an atom pair.");
    pairs.add(pair);
  });
  return { version: 1, atoms, bonds };
}
import { getElement } from "../../chemistry-core";
import { preferredBondLength } from "./moleculeGeometry";


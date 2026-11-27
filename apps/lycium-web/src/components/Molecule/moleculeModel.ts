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

export function parseMoleculeDocument(value: unknown): MoleculeDocument {
  if (!value || typeof value !== "object" || (value as { version?: unknown }).version !== 1) throw new Error("Unsupported molecule document.");
  const candidate = value as { atoms?: unknown; bonds?: unknown };
  if (!Array.isArray(candidate.atoms) || !Array.isArray(candidate.bonds)) throw new Error("Molecule atoms and bonds must be arrays.");
  const atoms = candidate.atoms.map(item => {
    if (!item || typeof item !== "object") throw new Error("Invalid atom.");
    const entry = item as Partial<MoleculeAtom>;
    if (typeof entry.id !== "string" || !/^[A-Z][a-z]?$/.test(String(entry.element)) || !Number.isFinite(entry.x) || !Number.isFinite(entry.y) ||
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
  return { version: 1, atoms, bonds };
}

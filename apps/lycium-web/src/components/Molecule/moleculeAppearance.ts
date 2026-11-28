import type { MoleculeAtom, MoleculeDocument } from "./moleculeModel";

export type MoleculeDisplayMode = "model" | "lewis";

const COVALENT_RADII: Record<string, number> = {
  H: 31, B: 85, C: 76, N: 71, O: 66, F: 57, Si: 111, P: 107, S: 105, Cl: 102, Br: 120, I: 139,
  Li: 128, Be: 96, Na: 166, Mg: 141, Al: 121, K: 203, Ca: 176, Fe: 132, Cu: 132, Zn: 122,
};

const ELEMENT_COLORS: Record<string, string> = {
  H: "#e8eef8", C: "#64748b", N: "#3b82f6", O: "#ef6464", F: "#34a76f", Si: "#b18b69", P: "#d88b32",
  S: "#d6a922", Cl: "#35a873", Br: "#a84d3f", I: "#8166b8", B: "#d69f72", Na: "#9675cf",
};

export function atomVisual(symbol: string, mode: MoleculeDisplayMode) {
  const covalentRadius = COVALENT_RADII[symbol] ?? 85;
  const compressedRadius = 20 + Math.max(0, Math.min(1, (covalentRadius - 31) / 172)) * 12;
  const color = ELEMENT_COLORS[symbol] ?? "#7c8da4";
  return { covalentRadius, radius: mode === "lewis" ? 17 : compressedRadius, color, labelColor: symbol === "H" ? "#172033" : "#ffffff" };
}

function angleDistance(a: number, b: number) {
  const difference = Math.abs(a - b) % (Math.PI * 2);
  return Math.min(difference, Math.PI * 2 - difference);
}

export function lonePairPositions(document: MoleculeDocument, atom: MoleculeAtom, radius: number) {
  const bondAngles = document.bonds.flatMap(bond => {
    const neighborId = bond.source === atom.id ? bond.target : bond.target === atom.id ? bond.source : null;
    const neighbor = neighborId ? document.atoms.find(item => item.id === neighborId) : null;
    return neighbor ? [Math.atan2(neighbor.y - atom.y, neighbor.x - atom.x)] : [];
  });
  const candidates = Array.from({ length: 12 }, (_, index) => -Math.PI / 2 + index * Math.PI / 6);
  return candidates
    .map(angle => ({ angle, clearance: bondAngles.length ? Math.min(...bondAngles.map(bondAngle => angleDistance(angle, bondAngle))) : Math.PI }))
    .sort((left, right) => right.clearance - left.clearance)
    .slice(0, atom.lonePairs)
    .map(({ angle }) => ({ x: Math.cos(angle) * (radius + 9), y: Math.sin(angle) * (radius + 9), angle }));
}


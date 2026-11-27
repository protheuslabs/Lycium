import type { MoleculeAtom, MoleculeDocument } from "./moleculeModel";

type CompareOptions = { bondOrders?: boolean; formalCharges?: boolean; lonePairs?: boolean };
const atomMatches = (a: MoleculeAtom, b: MoleculeAtom, options: Required<CompareOptions>) => a.element === b.element &&
  (!options.formalCharges || a.formalCharge === b.formalCharge) && (!options.lonePairs || a.lonePairs === b.lonePairs);

export function moleculesEquivalent(left: MoleculeDocument, right: MoleculeDocument, options: CompareOptions = {}) {
  if (left.atoms.length !== right.atoms.length || left.bonds.length !== right.bonds.length) return false;
  const settings = { bondOrders: options.bondOrders ?? true, formalCharges: options.formalCharges ?? true, lonePairs: options.lonePairs ?? true };
  const rightIndex = new Map(right.atoms.map((atom, index) => [atom.id, index]));
  const leftIndex = new Map(left.atoms.map((atom, index) => [atom.id, index]));
  const leftBonds = new Map(left.bonds.flatMap(bond => [[`${leftIndex.get(bond.source)}:${leftIndex.get(bond.target)}`, bond.order], [`${leftIndex.get(bond.target)}:${leftIndex.get(bond.source)}`, bond.order]]));
  const rightBonds = new Map(right.bonds.flatMap(bond => [[`${rightIndex.get(bond.source)}:${rightIndex.get(bond.target)}`, bond.order], [`${rightIndex.get(bond.target)}:${rightIndex.get(bond.source)}`, bond.order]]));
  const mapping = new Array<number>(left.atoms.length).fill(-1);
  const used = new Set<number>();
  function search(depth: number): boolean {
    if (depth === left.atoms.length) return true;
    for (let candidate = 0; candidate < right.atoms.length; candidate++) {
      if (used.has(candidate) || !atomMatches(left.atoms[depth], right.atoms[candidate], settings)) continue;
      let compatible = true;
      for (let prior = 0; prior < depth; prior++) {
        const leftOrder = leftBonds.get(`${depth}:${prior}`);
        const rightOrder = rightBonds.get(`${candidate}:${mapping[prior]}`);
        if (Boolean(leftOrder) !== Boolean(rightOrder) || (settings.bondOrders && leftOrder !== rightOrder)) { compatible = false; break; }
      }
      if (!compatible) continue;
      mapping[depth] = candidate; used.add(candidate);
      if (search(depth + 1)) return true;
      used.delete(candidate); mapping[depth] = -1;
    }
    return false;
  }
  return search(0);
}

import { atomVisual } from "./moleculeAppearance";
import type { MoleculeDocument } from "./moleculeModel";

const FULL_TURN = Math.PI * 2;
const DEGREE = Math.PI / 180;

function angularDistance(left: number, right: number) {
  const difference = Math.abs(left - right) % FULL_TURN;
  return Math.min(difference, FULL_TURN - difference);
}

function normalizeAngle(angle: number) {
  return ((angle % FULL_TURN) + FULL_TURN) % FULL_TURN;
}

export function preferredBondLength(sourceElement: string, targetElement: string) {
  return 58 + atomVisual(sourceElement, "model").radius + atomVisual(targetElement, "model").radius;
}

export type BondSnapOptions = { lengths: boolean; angles: boolean };

export function snapBondPosition(document: MoleculeDocument, sourceId: string, target: { x: number; y: number }, targetElement: string, options: BondSnapOptions = { lengths: true, angles: true }) {
  const source = document.atoms.find(atom => atom.id === sourceId);
  if (!source || (!options.lengths && !options.angles)) return target;
  const rawAngle = Math.atan2(target.y - source.y, target.x - source.x);
  const gridAngle = Math.round(rawAngle / (15 * DEGREE)) * 15 * DEGREE;
  const neighborAngles = document.bonds.flatMap(bond => {
    const neighborId = bond.source === sourceId ? bond.target : bond.target === sourceId ? bond.source : null;
    const neighbor = neighborId ? document.atoms.find(atom => atom.id === neighborId) : null;
    return neighbor ? [Math.atan2(neighbor.y - source.y, neighbor.x - source.x)] : [];
  });
  const preferredAngles = neighborAngles.flatMap(angle => [90, 109.5, 120, 180].flatMap(offset => [angle + offset * DEGREE, angle - offset * DEGREE]));
  const preferred = preferredAngles
    .map(angle => ({ angle, score: angularDistance(rawAngle, angle) - 8 * DEGREE }))
    .sort((left, right) => left.score - right.score)[0];
  const angle = options.angles ? preferred && preferred.score < angularDistance(rawAngle, gridAngle) ? preferred.angle : gridAngle : rawAngle;
  const rawLength = Math.hypot(target.x - source.x, target.y - source.y);
  const length = options.lengths ? preferredBondLength(source.element, targetElement) : rawLength;
  return { x: source.x + Math.cos(normalizeAngle(angle)) * length, y: source.y + Math.sin(normalizeAngle(angle)) * length };
}

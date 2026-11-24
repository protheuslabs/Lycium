import type { Curve } from "./graphIntersections";

/** Estimate a tangent only when both sides agree and the interval is finite. */
export function tangentAt(curve: Curve, x: number): { x: number; y: number; slope: number } {
  if (!Number.isFinite(x)) throw new Error("Enter a finite x coordinate.");
  const h = Math.max(1, Math.abs(x)) * 1e-5;
  const y = curve.evaluate(x), left = curve.evaluate(x - h), right = curve.evaluate(x + h);
  const interval = curve.interval(x - h, x + h);
  if (![y, left, right, interval.lo, interval.hi].every(Number.isFinite)) throw new Error("The function must be defined on both sides of this point.");
  const before = (y - left) / h, after = (right - y) / h;
  if (Math.abs(before - after) > 1e-3 * Math.max(1, Math.abs(before), Math.abs(after))) throw new Error("The slope is not defined at this point.");
  return { x, y, slope: (right - left) / (2 * h) };
}

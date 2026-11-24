import type { Curve } from "./graphIntersections";

/** Sample a bounded number of evenly spaced values, leaving undefined values empty. */
export function tableOfValues(curve: Curve, start: number, step: number, count: number): { x: number; y: number | null }[] {
  if (!Number.isFinite(start) || !Number.isFinite(step) || step === 0 || !Number.isInteger(count) || count < 1 || count > 100) {
    throw new Error("Enter a finite start, a nonzero step, and between 1 and 100 rows.");
  }
  return Array.from({ length: count }, (_, index) => {
    const x = start + index * step;
    if (!Number.isFinite(x)) throw new Error("The requested x values are too large.");
    try {
      const y = curve.evaluate(x);
      return { x, y: Number.isFinite(y) ? y : null };
    } catch { return { x, y: null }; }
  });
}

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

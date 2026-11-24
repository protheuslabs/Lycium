import type { Curve } from "./graphIntersections";

/** Approximate a signed integral, rejecting intervals the evaluator cannot bound. */
export function integrateCurve(curve: Curve, start: number, end: number): number {
  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(end - start)) throw new Error("Enter finite integration bounds.");
  if (start === end) return 0;
  const segments = 512;
  const step = (end - start) / segments;
  let total = 0;
  for (let i = 0; i < segments; i++) {
    const a = start + i * step, b = i === segments - 1 ? end : start + (i + 1) * step, middle = (a + b) / 2;
    const interval = curve.interval(Math.min(a, b), Math.max(a, b));
    const fa = curve.evaluate(a), fm = curve.evaluate(middle), fb = curve.evaluate(b);
    if (![interval.lo, interval.hi, fa, fm, fb].every(Number.isFinite) || interval.lo > interval.hi) throw new Error("The function is undefined or unbounded within these bounds.");
    total += (b - a) * (fa + 4 * fm + fb) / 6;
  }
  if (!Number.isFinite(total)) throw new Error("The integral could not be estimated.");
  return total;
}

/** Geometric area between two curves, including across crossings. */
export function areaBetweenCurves(first: Curve, second: Curve, start: number, end: number): number {
  const difference: Curve = {
    id: "area-difference",
    evaluate: (x) => Math.abs(first.evaluate(x) - second.evaluate(x)),
    interval: (lo, hi) => {
      const a = first.interval(lo, hi), b = second.interval(lo, hi);
      if (![a.lo, a.hi, b.lo, b.hi].every(Number.isFinite) || a.lo > a.hi || b.lo > b.hi) return { lo: NaN, hi: NaN };
      return { lo: 0, hi: Math.max(Math.abs(a.lo - b.hi), Math.abs(a.hi - b.lo)) };
    },
  };
  return Math.abs(integrateCurve(difference, start, end));
}

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

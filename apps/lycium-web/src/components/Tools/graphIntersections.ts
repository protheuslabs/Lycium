/** Numerically find sign-changing intersections. Tangencies are not guaranteed. */
export type IntervalValue = { lo: number; hi: number };
export type Curve = { id: string; evaluate: (x: number) => number; interval: (lo: number, hi: number) => IntervalValue };
export type Intersection = { first: string; second: string; x: number; y: number };
export type Intercept = { curve: string; axis: "x" | "y"; x: number; y: number };

/** Find sign-changing x-intercepts and the y-intercept in a visible viewport. */
export function findIntercepts(curves: readonly Curve[], xDomain: readonly [number, number], yDomain: readonly [number, number]): Intercept[] {
  const zero: Curve = { id: "__axis__", evaluate: () => 0, interval: () => ({ lo: 0, hi: 0 }) };
  const result: Intercept[] = [];
  for (const curve of curves) {
    if (yDomain[0] <= 0 && yDomain[1] >= 0) {
      for (const crossing of findCrossings([curve, zero], xDomain)) result.push({ curve: curve.id, axis: "x", x: crossing.x, y: 0 });
    }
    if (xDomain[0] <= 0 && xDomain[1] >= 0) {
      try {
        const y = curve.evaluate(0);
        if (Number.isFinite(y) && y >= yDomain[0] && y <= yDomain[1]) result.push({ curve: curve.id, axis: "y", x: 0, y });
      } catch { /* undefined at x=0 */ }
    }
  }
  return result.slice(0, 100);
}

export function findCrossings(curves: readonly Curve[], domain: readonly [number, number], samples = 256): Intersection[] {
  const [min, max] = domain;
  if (!Number.isFinite(min) || !Number.isFinite(max) || !(min < max) || !Number.isFinite(max - min)) return [];
  const results: Intersection[] = [];
  const dx = (max - min) / samples;
  for (let i = 0; i < curves.length; i++) for (let j = i + 1; j < curves.length; j++) {
    const a = curves[i], b = curves[j];
    const evaluate = (x: number) => { try { const y1 = a.evaluate(x), y2 = b.evaluate(x); return Number.isFinite(y1) && Number.isFinite(y2) ? y1 - y2 : NaN; } catch { return NaN; } };
    for (let k = 0; k < samples; k++) {
      let left = min + k * dx, right = k === samples - 1 ? max : min + (k + 1) * dx;
      let fl = evaluate(left), fr = evaluate(right);
      if (!Number.isFinite(fl) || !Number.isFinite(fr) || (fl === 0 && fr === 0) || (fl !== 0 && fr !== 0 && Math.sign(fl) === Math.sign(fr))) continue;
      try {
        // Reject candidate intervals where either function is unbounded or undefined.
        const intervals = [a.interval(left, right), b.interval(left, right)];
        if (intervals.some((v) => !v || !Number.isFinite(v.lo) || !Number.isFinite(v.hi) || v.lo > v.hi)) continue;
      } catch { continue; }
      for (let iteration = 0; iteration < 45 && fl !== 0 && fr !== 0; iteration++) {
        const mid = (left + right) / 2;
        if (mid === left || mid === right) break;
        const fm = evaluate(mid);
        if (!Number.isFinite(fm)) { left = NaN; break; }
        if (fm === 0) { left = right = mid; break; }
        if (Math.sign(fl) !== Math.sign(fm)) { right = mid; fr = fm; } else { left = mid; fl = fm; }
      }
      const x = fl === 0 ? left : fr === 0 ? right : (left + right) / 2;
      if (!Number.isFinite(x)) continue;
      try {
        const y1 = a.evaluate(x), y2 = b.evaluate(x);
        const tolerance = 1e-7 * Math.max(1, Math.abs(y1), Math.abs(y2));
        if (!Number.isFinite(y1) || !Number.isFinite(y2) || Math.abs(y1 - y2) > tolerance) continue;
        if (results.some((point) => point.first === a.id && point.second === b.id && Math.abs(point.x - x) < dx / 4)) continue;
        results.push({ first: a.id, second: b.id, x, y: (y1 + y2) / 2 });
      } catch { continue; }
      if (results.length >= 100) return results;
    }
  }
  return results;
}

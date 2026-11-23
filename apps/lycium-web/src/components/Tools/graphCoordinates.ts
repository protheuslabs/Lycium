export type CoordinatePrecision = "auto" | 0 | 1 | 2 | 3 | 4 | 6;

export function gridStepFromTicks(ticks: readonly number[]): number {
  for (let index = 1; index < ticks.length; index++) {
    const step = Math.abs(ticks[index] - ticks[index - 1]);
    if (Number.isFinite(step) && step > 0) return Number(step.toPrecision(12));
  }
  return 1;
}

export function formatCoordinate(value: number, gridStep: number, precision: CoordinatePrecision = "auto"): string {
  if (!Number.isFinite(value)) return "undefined";
  const decimals = precision === "auto"
    ? Math.min(10, Math.max(2, Math.ceil(-Math.log10(gridStep > 0 ? gridStep : 1)) + 1))
    : precision;
  const magnitude = Math.abs(value);
  if (magnitude !== 0 && (magnitude >= 1e7 || magnitude < 1e-8)) {
    const [coefficient, exponent] = value.toExponential(precision === "auto" ? 3 : decimals).split("e");
    return `${Number(coefficient)}e${Number(exponent)}`;
  }
  // Display rounding only: never pass the formatted value back to the evaluator.
  return String(Number(value.toFixed(decimals)));
}

export function snapCoordinate(value: number, step: number, domain: readonly number[]): number {
  if (!Number.isFinite(value) || !Number.isFinite(step) || step <= 0) return value;
  const first = Math.ceil(Math.min(...domain) / step);
  const last = Math.floor(Math.max(...domain) / step);
  if (!Number.isFinite(first) || !Number.isFinite(last) || first > last) return value;
  const snapped = Math.max(first, Math.min(last, Math.round(value / step))) * step;
  return Object.is(snapped, -0) ? 0 : snapped;
}

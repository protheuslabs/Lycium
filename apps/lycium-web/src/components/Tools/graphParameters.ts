export interface GraphParameter {
  name: string;
  value: number;
  min: number;
  max: number;
  step: number;
}

// Avoid x/y, mathematical constants, and function names.
export const PARAMETER_NAMES = ["a", "b", "c", "d", "k", "m", "n", "p", "q", "r", "s", "u", "v", "w"];

export function parameterRangeError(min: number, max: number, step: number): string | null {
  if (![min, max, step].every(Number.isFinite)) return "Enter a number for each range setting.";
  if (min >= max || !Number.isFinite(max - min)) return "Maximum must be greater than minimum, with a finite range.";
  if (step <= 0 || step > max - min) return "Step must be positive and no larger than the range.";
  if (!Number.isFinite((max - min) / step) || min + step === min || max - step === max) return "Step is too small for this range.";
  return null;
}

export function snapParameterValue(value: number, min: number, max: number, step: number): number {
  const lastStep = Math.floor((max - min) / step + 1e-10);
  const nearestStep = Math.max(0, Math.min(lastStep, Math.round((value - min) / step)));
  const snapped = min + nearestStep * step;
  const rounded = Number(snapped.toPrecision(12));
  const valueWithoutRoundingNoise = Math.abs(rounded - snapped) <= step * 1e-6 ? rounded : snapped;
  return Math.max(min, Math.min(max, valueWithoutRoundingNoise));
}

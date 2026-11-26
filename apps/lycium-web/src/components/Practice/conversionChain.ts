export type Quantity = { id: string; value: number; unit: string; species: string };
export type Ratio = { numerator: Quantity; denominator: Quantity };
export type Factor = { numerator: string; denominator: string };

export type ConversionValidation = {
  status: "correct" | "incomplete" | "invalid-ratio" | "uncancelled-units" | "wrong-value";
  valid: boolean;
  correct: boolean;
  credit: 0 | 1;
  value?: number;
  factorIndex?: number;
};

const dimension = (quantity: Quantity) => JSON.stringify([quantity.unit, quantity.species]);

export function validateConversionChain(start: Quantity, target: Quantity, ratios: Ratio[], factors: Factor[]): ConversionValidation {
  const dimensions = new Map([[dimension(start), 1]]);
  function add(quantity: Quantity, power: number) {
    const key = dimension(quantity);
    dimensions.set(key, (dimensions.get(key) ?? 0) + power);
  }
  let value = start.value;
  for (const [factorIndex, factor] of factors.entries()) {
    if (!factor.numerator || !factor.denominator) {
      return { status: "incomplete", valid: false, correct: false, credit: 0, factorIndex };
    }
    const ratio = ratios.find(item =>
      (item.numerator.id === factor.numerator && item.denominator.id === factor.denominator) ||
      (item.denominator.id === factor.numerator && item.numerator.id === factor.denominator));
    if (!ratio) return { status: "invalid-ratio", valid: true, correct: false, credit: 0, factorIndex };
    const forward = ratio.numerator.id === factor.numerator;
    const [top, bottom] = forward ? [ratio.numerator, ratio.denominator] : [ratio.denominator, ratio.numerator];
    add(top, 1);
    add(bottom, -1);
    value *= top.value / bottom.value;
  }
  add(target, -1);
  if ([...dimensions.values()].some(power => power !== 0)) {
    return { status: "uncancelled-units", valid: true, correct: false, credit: 0 };
  }
  if (!Number.isFinite(value) || Math.abs(value - target.value) > Math.abs(target.value) * 1e-10) {
    return { status: "wrong-value", valid: true, correct: false, credit: 0, value };
  }
  return { status: "correct", valid: true, correct: true, credit: 1, value };
}

export function getCancelledQuantityIds(start: Quantity, quantities: Quantity[], factors: Factor[]) {
  const occurrences = new Map<string, { top: string[]; bottom: string[] }>();
  const add = (quantity: Quantity, side: "top" | "bottom", id: string) => {
    const key = dimension(quantity);
    const entry = occurrences.get(key) ?? { top: [], bottom: [] };
    entry[side].push(id);
    occurrences.set(key, entry);
  };
  add(start, "top", "start");
  factors.forEach((factor, index) => {
    const numerator = quantities.find(item => item.id === factor.numerator);
    const denominator = quantities.find(item => item.id === factor.denominator);
    if (numerator) add(numerator, "top", `${index}:numerator`);
    if (denominator) add(denominator, "bottom", `${index}:denominator`);
  });
  const cancelled = new Set<string>();
  for (const entry of occurrences.values()) {
    const count = Math.min(entry.top.length, entry.bottom.length);
    entry.top.slice(0, count).forEach(id => cancelled.add(id));
    entry.bottom.slice(0, count).forEach(id => cancelled.add(id));
  }
  return cancelled;
}

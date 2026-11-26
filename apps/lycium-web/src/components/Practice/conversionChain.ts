export type Quantity = { id: string; value: number; unit: string; species: string };
export type Ratio = { numerator: Quantity; denominator: Quantity };
export type Factor = { numerator: string; denominator: string };

const dimension = (quantity: Quantity) => JSON.stringify([quantity.unit, quantity.species]);

export function validateConversionChain(start: Quantity, target: Quantity, ratios: Ratio[], factors: Factor[]) {
  const dimensions = new Map([[dimension(start), 1]]);
  function add(quantity: Quantity, power: number) {
    const key = dimension(quantity);
    dimensions.set(key, (dimensions.get(key) ?? 0) + power);
  }
  let value = start.value;
  for (const factor of factors) {
    const ratio = ratios.find(item =>
      (item.numerator.id === factor.numerator && item.denominator.id === factor.denominator) ||
      (item.denominator.id === factor.numerator && item.numerator.id === factor.denominator));
    if (!ratio) return { status: "invalid-ratio" } as const;
    const forward = ratio.numerator.id === factor.numerator;
    const [top, bottom] = forward ? [ratio.numerator, ratio.denominator] : [ratio.denominator, ratio.numerator];
    add(top, 1);
    add(bottom, -1);
    value *= top.value / bottom.value;
  }
  add(target, -1);
  if ([...dimensions.values()].some(power => power !== 0)) return { status: "uncancelled-units" } as const;
  if (!Number.isFinite(value) || Math.abs(value - target.value) > Math.abs(target.value) * 1e-10) {
    return { status: "wrong-value" } as const;
  }
  return { status: "correct", value } as const;
}

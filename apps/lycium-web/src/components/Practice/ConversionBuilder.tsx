import { useMemo, useState } from "react";
import { getCancelledQuantityIds, validateConversionChain, type Factor, type Quantity, type Ratio } from "./conversionChain";

type Props = {
  start: Quantity; target: Quantity; quantities: Quantity[]; ratios: Ratio[];
  factors: Factor[]; onChange: (factors: Factor[]) => void;
  feedback: string; onCheck: (status: ReturnType<typeof validateConversionChain>["status"], message: string) => void;
  prompt?: string; decimals?: number; disabled?: boolean;
};
const blank = (): Factor => ({ numerator: "", denominator: "" });

export default function ConversionBuilder({ start, target, quantities, ratios, factors, onChange, feedback, onCheck, prompt, decimals = 8, disabled = false }: Props) {
  const [active, setActive] = useState<{ index: number; side: keyof Factor }>({ index: 0, side: "numerator" });
  const restoredResult = disabled ? validateConversionChain(start, target, ratios, factors) : null;
  const [lastResult, setLastResult] = useState<ReturnType<typeof validateConversionChain> | null>(restoredResult);
  const cancelled = useMemo(() => getCancelledQuantityIds(start, quantities, factors), [factors, quantities, start]);
  function update(next: Factor[]) {
    setLastResult(null);
    onChange(next);
  }
  function check() {
    const result = validateConversionChain(start, target, ratios, factors);
    const messages = {
      correct: `The units cancel and the conversion gives ${Number(target.value.toPrecision(8))} ${target.unit} ${target.species} before rounding.`,
      incomplete: `Factor ${(result.factorIndex ?? 0) + 1} is incomplete. Fill both cells before checking.`,
      "invalid-ratio": `Factor ${(result.factorIndex ?? 0) + 1} does not describe a valid conversion relationship.`,
      "uncancelled-units": "The units and species do not cancel to the target. Check for inverted or missing factors.",
      "wrong-value": "The units cancel, but the conversion gives the wrong quantity.",
    };
    setLastResult(result);
    onCheck(result.status, messages[result.status]);
  }
  const choose = (quantity: Quantity) => {
    update(factors.map((factor, index) => index === active.index ? { ...factor, [active.side]: quantity.id } : factor));
    setActive(current => current.side === "numerator" ? { ...current, side: "denominator" } :
      { index: Math.min(current.index + 1, factors.length - 1), side: "numerator" });
  };
  return <section className="practice-conversion" aria-label="Conversion chain">
    <h3>{prompt ?? "Set up your calculation"}</h3>
    <p>Convert {start.value} {start.unit} {start.species} to {target.unit} {target.species}.</p>
    <div className="practice-conversion-factors" aria-label="Dimensional analysis workspace">
      <div className="practice-conversion-start"><strong>{start.value}</strong><span className={cancelled.has("start") ? "is-cancelled" : ""}>{start.unit} {start.species}</span></div>
      {factors.map((factor, index) => <fieldset key={index} className={lastResult?.factorIndex === index ? "has-error" : ""}>
        <legend>Factor {index + 1}</legend>
        {(["numerator", "denominator"] as const).map(side => {
          const selected = quantities.find(item => item.id === factor[side]);
          return <button key={side} type="button" className="practice-factor-cell"
            aria-pressed={active.index === index && active.side === side} disabled={disabled}
            onClick={() => setActive({ index, side })}>
            {selected ? <><strong>{selected.value}</strong><span className={cancelled.has(`${index}:${side}`) ? "is-cancelled" : ""}>{selected.unit} {selected.species}</span></> : "?"}
          </button>;
        })}
        {!disabled && <button type="button" className="practice-factor-invert" onClick={() => update(factors.map((item, itemIndex) =>
          itemIndex === index ? { numerator: item.denominator, denominator: item.numerator } : item))}>Invert</button>}
      </fieldset>)}
      <div className="practice-conversion-result" aria-label="Target answer"><span>=</span><strong>{lastResult?.correct ? Number(target.value.toFixed(decimals)) : "?"}</strong><span>{target.unit} {target.species}</span></div>
    </div>
    {!disabled && <><p className="practice-builder-instruction">Select a fraction cell, then choose a number and unit pair.</p>
      <div className="practice-quantity-palette" aria-label="Available quantities">
        {quantities.map(quantity => <button type="button" key={quantity.id} onClick={() => choose(quantity)}>
          <strong>{quantity.value}</strong><span>{quantity.unit} {quantity.species}</span>
        </button>)}
      </div></>}
    <div className="practice-actions">
      {!disabled && <button type="button" disabled={factors.length >= 12} onClick={() => {
        update([...factors, blank()]);
        setActive({ index: factors.length, side: "numerator" });
      }}>+ Factor</button>}
      {!disabled && factors.length > 1 && <button type="button" onClick={() => {
        update(factors.slice(0, -1));
        setActive({ index: Math.max(0, factors.length - 2), side: "numerator" });
      }}>− Factor</button>}
      {!disabled && <button type="button" onClick={() => {
        update(createBlankFactors(Math.max(1, ratios.length)));
        setActive({ index: 0, side: "numerator" });
      }}>Reset</button>}
      <button className="practice-primary" type="button" disabled={disabled || !factors.length || factors.some(item => !item.numerator || !item.denominator)} onClick={check}>Check calculation</button>
    </div>
    <p role="status">{feedback}</p>
  </section>;
}

export const createBlankFactors = (count: number) => Array.from({ length: count }, blank);

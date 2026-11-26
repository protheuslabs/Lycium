import { validateConversionChain, type Factor, type Quantity, type Ratio } from "./conversionChain";

type Props = {
  start: Quantity; target: Quantity; quantities: Quantity[]; ratios: Ratio[];
  factors: Factor[]; onChange: (factors: Factor[]) => void;
  feedback: string; onCheck: (status: ReturnType<typeof validateConversionChain>["status"], message: string) => void;
  prompt?: string; disabled?: boolean;
};
const blank = (): Factor => ({ numerator: "", denominator: "" });

export default function ConversionBuilder({ start, target, quantities, ratios, factors, onChange, feedback, onCheck, prompt, disabled = false }: Props) {
  const [active, setActive] = useState<{ index: number; side: keyof Factor }>({ index: 0, side: "numerator" });
  function update(next: Factor[]) {
    onChange(next);
  }
  function check() {
    const result = validateConversionChain(start, target, ratios, factors);
    const messages = {
      correct: `The units cancel and the conversion gives ${Number(target.value.toPrecision(8))} ${target.unit} ${target.species} before rounding.`,
      "invalid-ratio": "One fraction does not describe a valid molar-mass or reaction ratio.",
      "uncancelled-units": "The units and species do not cancel to the target. Check for inverted or missing factors.",
      "wrong-value": "The units cancel, but the conversion gives the wrong quantity.",
    };
    onCheck(result.status, messages[result.status]);
  }
  return <section className="practice-conversion" aria-label="Conversion chain">
    <h3>{prompt ?? "Set up your calculation"}</h3>
    <p>Convert {start.value} {start.unit} {start.species} to {target.unit} {target.species}.</p>
    <div className="practice-conversion-factors">
      <div className="practice-conversion-start"><strong>{start.value}</strong><span>{start.unit} {start.species}</span></div>
      {factors.map((factor, index) => <fieldset key={index}>
        <legend>Factor {index + 1}</legend>
        {(["numerator", "denominator"] as const).map(side => {
          const selected = quantities.find(item => item.id === factor[side]);
          return <button key={side} type="button" className="practice-factor-cell"
            aria-pressed={active.index === index && active.side === side} disabled={disabled}
            onClick={() => setActive({ index, side })}>
            {selected ? `${selected.value} ${selected.unit} ${selected.species}` : "?"}
          </button>;
        })}
      </fieldset>)}
    </div>
    {!disabled && <><p>Select a fraction cell, then choose a quantity.</p>
      <div className="practice-quantity-palette">
        {quantities.map(quantity => <button type="button" key={quantity.id} onClick={() => {
          update(factors.map((factor, index) => index === active.index ? { ...factor, [active.side]: quantity.id } : factor));
          setActive(current => current.side === "numerator" ? { ...current, side: "denominator" } :
            { index: Math.min(current.index + 1, factors.length - 1), side: "numerator" });
        }}>{quantity.value} {quantity.unit} {quantity.species}</button>)}
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
      <button className="practice-primary" type="button" disabled={disabled || !factors.length || factors.some(item => !item.numerator || !item.denominator)} onClick={check}>Check calculation</button>
    </div>
    <p role="status">{feedback}</p>
  </section>;
}

export const createBlankFactors = (count: number) => Array.from({ length: count }, blank);
import { useState } from "react";

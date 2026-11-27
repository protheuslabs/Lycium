import { useMemo, useState } from "react";
import { getCancelledQuantityIds, validateConversionChain, type Factor, type Quantity, type Ratio } from "./conversionChain";
import { validateNumeric } from "./interactionValidation";

type Props = {
  start: Quantity; target: Quantity; quantities: Quantity[]; ratios: Ratio[];
  factors: Factor[]; onChange: (factors: Factor[]) => void;
  answer: string; onAnswerChange: (answer: string) => void;
  feedback: string; onCheck: (status: string, message: string) => void;
  prompt?: string; decimals?: number; disabled?: boolean; partIndex?: number;
};
const blank = (): Factor => ({ numerator: "", denominator: "" });

export default function ConversionBuilder({ start, target, quantities, ratios, factors, onChange, answer, onAnswerChange, feedback, onCheck, prompt, decimals = 8, disabled = false, partIndex = 0 }: Props) {
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
    if (!result.correct) return onCheck(result.status, messages[result.status]);
    const calculation = validateNumeric(answer, { expected: target.value, precision: { type: "decimal-places", digits: decimals } });
    onCheck(calculation.status, calculation.correct ? "The conversion setup and numerical answer are correct." : calculation.message);
  }
  const choose = (quantity: Quantity) => {
    update(factors.map((factor, index) => index === active.index ? { ...factor, [active.side]: quantity.id } : factor));
    setActive(current => current.side === "numerator" ? { ...current, side: "denominator" } :
      { index: Math.min(current.index + 1, factors.length - 1), side: "numerator" });
  };
  const shortPrompt = (prompt ?? "Set up your calculation").replace(/^Part\s+[A-Z]\s*[—-]\s*/i, "");
  const partLetter = String.fromCharCode(65 + partIndex);
  if (disabled) return <section className="practice-conversion-complete" aria-label={`${prompt ?? "Conversion"} complete`}>
    <span className="practice-correct-mark" aria-hidden="true">✓</span>
    <div><h3>{prompt ?? "Completed conversion"}</h3>
      <p className="practice-math-line"><strong>{start.value}</strong> <span>{start.unit} {start.species}</span>
        {factors.map((factor, index) => {
          const numerator = quantities.find(item => item.id === factor.numerator);
          const denominator = quantities.find(item => item.id === factor.denominator);
          return <span className="practice-inline-factor" key={`${factor.numerator}-${factor.denominator}-${index}`}>× <span className="practice-fraction">
            <span>{numerator?.value} {numerator?.unit} {numerator?.species}</span>
            <span>{denominator?.value} {denominator?.unit} {denominator?.species}</span>
          </span></span>;
        })} = <strong>{answer}</strong> {target.unit} {target.species}</p>
    </div><span className="practice-complete-label">Correct</span>
  </section>;
  return <section className="practice-conversion" aria-label="Conversion chain">
    <h3><span className="practice-part-badge" aria-hidden="true">{partLetter}</span>{shortPrompt}</h3>
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
      <label className="practice-conversion-result" aria-label="Numerical answer"><span>=</span><input value={answer} inputMode="decimal" onChange={event => onAnswerChange(event.target.value)} /><span>{target.unit} {target.species}</span></label>
    </div>
    {!disabled && <><p className="practice-builder-instruction">Available quantities</p>
      <div className="practice-quantity-palette" aria-label="Available quantities">
        {quantities.map(quantity => <button type="button" key={quantity.id} onClick={() => choose(quantity)}>
          <strong>{quantity.value}</strong><span>{quantity.unit} {quantity.species}</span>
        </button>)}
      </div></>}
    <div className="practice-actions">
      <button className="practice-primary" type="button" disabled={disabled || !answer.trim() || !factors.length || factors.some(item => !item.numerator || !item.denominator)} onClick={check}>Check calculation</button>
    </div>
    <p role="status">{feedback}</p>
  </section>;
}

export const createBlankFactors = (count: number) => Array.from({ length: count }, blank);

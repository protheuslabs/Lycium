import { useState } from "react";
import { validateConversionChain, type Factor, type Quantity, type Ratio } from "./conversionChain";

type Props = { start: Quantity; target: Quantity; quantities: Quantity[]; ratios: Ratio[] };
const blank = (): Factor => ({ numerator: "", denominator: "" });

export default function ConversionBuilder({ start, target, quantities, ratios }: Props) {
  const [factors, setFactors] = useState<Factor[]>(() => Array.from({ length: 3 }, blank));
  const [feedback, setFeedback] = useState("");
  function update(next: Factor[]) {
    setFactors(next);
    setFeedback("");
  }
  function check() {
    const result = validateConversionChain(start, target, ratios, factors);
    const messages = {
      correct: `The units cancel and the conversion gives ${Number(target.value.toPrecision(8))} ${target.unit} ${target.species} before rounding.`,
      "invalid-ratio": "One fraction does not describe a valid molar-mass or reaction ratio.",
      "uncancelled-units": "The units and species do not cancel to the target. Check for inverted or missing factors.",
      "wrong-value": "The units cancel, but the conversion gives the wrong quantity.",
    };
    setFeedback(messages[result.status]);
  }
  return <details className="practice-conversion">
    <summary>Build a conversion chain</summary>
    <p>Convert {start.value} {start.unit} {start.species} to {target.unit} {target.species}.</p>
    <div className="practice-conversion-factors">
      {factors.map((factor, index) => <fieldset key={index}>
        <legend>Factor {index + 1}</legend>
        {(["numerator", "denominator"] as const).map(side => <label key={side}>
          {side === "numerator" ? "Numerator" : "Denominator"}
          <select value={factor[side]} onChange={event => update(factors.map((item, position) =>
            position === index ? { ...item, [side]: event.target.value } : item))}>
            <option value="">Choose quantity</option>
            {quantities.map(item => <option key={item.id} value={item.id}>{item.value} {item.unit} {item.species}</option>)}
          </select>
        </label>)}
        <button type="button" aria-label={`Remove factor ${index + 1}`} onClick={() => update(factors.filter((_, position) => position !== index))}>Remove</button>
      </fieldset>)}
    </div>
    <div className="practice-actions">
      <button type="button" disabled={factors.length >= 12} onClick={() => update([...factors, blank()])}>Add factor</button>
      <button type="button" disabled={!factors.length || factors.some(item => !item.numerator || !item.denominator)} onClick={check}>Check conversion</button>
    </div>
    <p role="status">{feedback}</p>
  </details>;
}

import ConversionBuilder, { createBlankFactors } from "./ConversionBuilder";
import type { Factor } from "./conversionChain";
import type { GeneratedPracticeInteraction } from "./conversionRuntime";

type Props = {
  interaction: GeneratedPracticeInteraction;
  serialized: string;
  feedback: string;
  complete: boolean;
  onChange: (serialized: string) => void;
  onValidate: (status: string, message: string, response: string) => void;
};

function readFactors(serialized: string, count: number): Factor[] {
  try {
    const value = JSON.parse(serialized) as unknown;
    if (Array.isArray(value) && value.every(item => typeof item === "object" && item !== null &&
      typeof item.numerator === "string" && typeof item.denominator === "string")) return value;
  } catch {
    // Invalid persisted interaction data starts with a clean workspace.
  }
  return createBlankFactors(count);
}

function ConversionChainInteraction({ interaction, serialized, feedback, complete, onChange, onValidate }: Props & { interaction: Extract<GeneratedPracticeInteraction, { type: "conversion-chain" }> }) {
    const factors = readFactors(serialized, interaction.ratios.length);
    return <ConversionBuilder {...interaction} factors={factors} feedback={feedback} disabled={complete}
      onChange={next => onChange(JSON.stringify(next))}
      onCheck={(status, message) => onValidate(status, message, JSON.stringify(factors))} />;
}
function ChoiceInteraction({ interaction, serialized, feedback, complete, onChange, onValidate }: Props & { interaction: Extract<GeneratedPracticeInteraction, { type: "choice" }> }) {
    return <fieldset className="practice-choices" disabled={complete}>
      <legend>{interaction.prompt}</legend>
      {interaction.options.map(option => <label key={option.id}>
        <input type="radio" name={interaction.id} value={option.id} checked={serialized === option.id} onChange={() => onChange(option.id)} /> {option.label}
      </label>)}
      {!complete && <button className="practice-primary" type="button" disabled={!serialized}
        onClick={() => onValidate(serialized === interaction.expected ? "correct" : "incorrect",
          serialized === interaction.expected ? "Correct." : "Review the mole-to-coefficient ratios and try again.", serialized)}>Check answer</button>}
      <p role="status">{feedback}</p>
    </fieldset>;
}
function NumericInteraction({ interaction, serialized, feedback, complete, onChange, onValidate }: Props & { interaction: Extract<GeneratedPracticeInteraction, { type: "numeric" }> }) {
    const entered = Number(serialized);
    const roundedExpected = interaction.precision.type === "decimal-places"
      ? Number(interaction.expected.toFixed(interaction.precision.digits))
      : Number(interaction.expected.toPrecision(interaction.precision.digits));
    const tolerance = Math.max(Number.EPSILON * Math.abs(roundedExpected) * 4,
      interaction.precision.type === "decimal-places" ? .5 * 10 ** -interaction.precision.digits : 0);
    return <section className="practice-numeric">
      <h3>{interaction.prompt}</h3>
      <label>Answer <span className="practice-answer"><input inputMode="decimal" disabled={complete} value={serialized}
        onChange={event => onChange(event.target.value)} /> {interaction.unit}</span></label>
      {!complete && <button className="practice-primary" type="button" disabled={!serialized.trim()} onClick={() => {
        const valid = Number.isFinite(entered);
        const correct = valid && Math.abs(entered - roundedExpected) <= tolerance;
        const precisionLabel = interaction.precision.type === "decimal-places"
          ? `${interaction.precision.digits} decimal places` : `${interaction.precision.digits} significant figures`;
        onValidate(correct ? "correct" : "incorrect", correct ? "Correct." : valid ? `Round to ${precisionLabel} and try again.` : "Enter a valid number.", serialized);
      }}>Check answer</button>}
      <p role="status">{feedback}</p>
    </section>;
}

export default function PracticeInteraction(props: Props) {
  if (props.interaction.type === "conversion-chain") return <ConversionChainInteraction {...props} interaction={props.interaction} />;
  if (props.interaction.type === "choice") return <ChoiceInteraction {...props} interaction={props.interaction} />;
  return <NumericInteraction {...props} interaction={props.interaction} />;
}

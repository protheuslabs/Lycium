import ConversionBuilder, { createBlankFactors } from "./ConversionBuilder";
import type { Factor } from "./conversionChain";
import type { GeneratedPracticeInteraction } from "./conversionRuntime";
import { validateChoice, validateNumeric } from "./interactionValidation";

type Props = {
  interaction: GeneratedPracticeInteraction;
  serialized: string;
  feedback: string;
  complete: boolean;
  partIndex?: number;
  onChange: (serialized: string) => void;
  onValidate: (status: string, message: string, response: string) => void;
};

function readFactors(serialized: string, count: number): Factor[] {
  try {
    const value = JSON.parse(serialized) as unknown;
    const factors = Array.isArray(value) ? value : typeof value === "object" && value !== null && "factors" in value ? value.factors : null;
    if (Array.isArray(factors) && factors.every(item => typeof item === "object" && item !== null &&
      typeof item.numerator === "string" && typeof item.denominator === "string")) return factors;
  } catch {
    // Invalid persisted interaction data starts with a clean workspace.
  }
  return createBlankFactors(count);
}

function readConversionAnswer(serialized: string) {
  try {
    const value = JSON.parse(serialized) as unknown;
    return typeof value === "object" && value !== null && "answer" in value && typeof value.answer === "string" ? value.answer : "";
  } catch { return ""; }
}

function ConversionChainInteraction({ interaction, serialized, feedback, complete, partIndex, onChange, onValidate }: Props & { interaction: Extract<GeneratedPracticeInteraction, { type: "conversion-chain" }> }) {
    const factors = readFactors(serialized, interaction.ratios.length);
    const answer = readConversionAnswer(serialized);
    const serialize = (nextFactors: Factor[], nextAnswer: string) => JSON.stringify({ factors: nextFactors, answer: nextAnswer });
    return <ConversionBuilder {...interaction} factors={factors} feedback={feedback} disabled={complete} partIndex={partIndex}
      answer={answer} onChange={next => onChange(serialize(next, answer))} onAnswerChange={next => onChange(serialize(factors, next))}
      onCheck={(status, message) => onValidate(status, message, serialize(factors, answer))} />;
}
function ChoiceInteraction({ interaction, serialized, feedback, complete, onChange, onValidate }: Props & { interaction: Extract<GeneratedPracticeInteraction, { type: "choice" }> }) {
    return <fieldset className="practice-choices" disabled={complete}>
      <legend>{interaction.prompt}</legend>
      {interaction.options.map(option => <label key={option.id}>
        <input type="radio" name={interaction.id} value={option.id} checked={serialized === option.id} onChange={() => onChange(option.id)} /> {option.label}
      </label>)}
      {!complete && <button className="practice-primary" type="button" disabled={!serialized}
        onClick={() => { const result = validateChoice(serialized, interaction.expected); onValidate(result.status, result.message, serialized); }}>Check answer</button>}
      <p role="status">{feedback}</p>
    </fieldset>;
}
function NumericInteraction({ interaction, serialized, feedback, complete, onChange, onValidate }: Props & { interaction: Extract<GeneratedPracticeInteraction, { type: "numeric" }> }) {
    return <section className="practice-numeric">
      <h3>{interaction.prompt}</h3>
      <label>Answer <span className="practice-answer"><input inputMode="decimal" disabled={complete} value={serialized}
        onChange={event => onChange(event.target.value)} /> {interaction.unit}</span></label>
      {!complete && <button className="practice-primary" type="button" disabled={!serialized.trim()} onClick={() => {
        const result = validateNumeric(serialized, interaction);
        onValidate(result.status, result.message, serialized);
      }}>Check answer</button>}
      <p role="status">{feedback}</p>
    </section>;
}

export default function PracticeInteraction(props: Props) {
  if (props.interaction.type === "conversion-chain") return <ConversionChainInteraction {...props} interaction={props.interaction} />;
  if (props.interaction.type === "choice") return <ChoiceInteraction {...props} interaction={props.interaction} />;
  return <NumericInteraction {...props} interaction={props.interaction} />;
}

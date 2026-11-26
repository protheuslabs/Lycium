import ConversionBuilder, { createBlankFactors } from "./ConversionBuilder";
import type { Factor } from "./conversionChain";
import type { GeneratedConversionInteraction } from "./conversionRuntime";

type Props = {
  interaction: GeneratedConversionInteraction;
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

const interactionRegistry = {
  "conversion-chain": function ConversionChainInteraction({ interaction, serialized, feedback, complete, onChange, onValidate }: Props) {
    const factors = readFactors(serialized, interaction.ratios.length);
    return <ConversionBuilder {...interaction} factors={factors} feedback={feedback} disabled={complete}
      onChange={next => onChange(JSON.stringify(next))}
      onCheck={(status, message) => onValidate(status, message, JSON.stringify(factors))} />;
  },
};

export default function PracticeInteraction(props: Props) {
  const Component = interactionRegistry[props.interaction.type];
  return <Component {...props} />;
}

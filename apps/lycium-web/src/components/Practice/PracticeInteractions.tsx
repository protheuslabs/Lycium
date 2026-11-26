const choices = [
  { id: "multiply", label: "Multiply the first quantity by the second" },
  { id: "divide", label: "Divide the first quantity by the second" },
  { id: "reverse", label: "Divide the second quantity by the first" },
  { id: "add", label: "Add the two quantities" },
] as const;

export function Equation({ operation, first, second, result }: {
  operation: string; first: string; second: string; result: string;
}) {
  const fraction = operation === "divide" || operation === "reverse";
  const [top, bottom] = operation === "reverse" ? [second, first] : [first, second];
  return <span className="practice-math">
    {result} = {fraction
      ? <span className="practice-fraction" aria-label={`${top} divided by ${bottom}`}><span>{top}</span><span>{bottom}</span></span>
      : <>{first} {operation === "multiply" ? "×" : "+"} {second}</>}
  </span>;
}

export function EquationChoices({ value, onChange, symbols }: {
  value: string; onChange: (value: string) => void;
  symbols: { first: string; second: string; result: string };
}) {
  return <fieldset className="practice-choices">
    <legend>1. Choose the equation</legend>
    {choices.map(choice => <label key={choice.id}>
      <input type="radio" name="equation" aria-label={choice.label} checked={value === choice.id} onChange={() => onChange(choice.id)} />
      <Equation operation={choice.id} {...symbols} />
    </label>)}
  </fieldset>;
}

export function QuantityCard({ label, value, unit, symbol }: {
  label: string; value: number; unit: string; symbol: string;
}) {
  return <div className="practice-quantity">
    <span>{label}</span>
    <strong>{value} <span>{unit}</span></strong>
    <var>{symbol}</var>
  </div>;
}

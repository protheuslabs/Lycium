"use client";

import { useId, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { PARAMETER_NAMES, parameterRangeError, snapParameterValue, type GraphParameter } from "./graphParameters";

type ParameterSlidersProps = {
  parameters: readonly GraphParameter[];
  onChange: (parameters: GraphParameter[]) => void;
};

function ParameterSlider({ parameter, onChange, onRemove }: {
  parameter: GraphParameter;
  onChange: (parameter: GraphParameter) => void;
  onRemove: () => void;
}) {
  const id = useId();
  const [range, setRange] = useState({ min: String(parameter.min), max: String(parameter.max), step: String(parameter.step) });
  const [error, setError] = useState<string | null>(null);
  const { name, value, min, max, step } = parameter;

  return (
    <section className="graphing-parameter" aria-label={`Parameter ${name} controls`}>
      <div className="graphing-parameter-header">
        <label htmlFor={id}>{name} = <output htmlFor={id}>{value}</output></label>
        <button type="button" className="graphing-icon-button" aria-label={`Remove slider ${name}`} title={`Remove slider ${name}`} onClick={onRemove}><Trash2 size={16} aria-hidden="true" /></button>
      </div>
      <input id={id} aria-label={`Parameter ${name}`} aria-valuetext={`${name} = ${value}`} type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange({ ...parameter, value: Number(event.target.value) })} />
      <div className="graphing-parameter-limits" aria-hidden="true"><span>{min}</span><span>{max}</span></div>
      <details className="graphing-parameter-settings">
        <summary>Range and step</summary>
        <form noValidate onSubmit={(event) => {
          event.preventDefault();
          const parse = (input: string) => input.trim() === "" ? NaN : Number(input);
          const next = { min: parse(range.min), max: parse(range.max), step: parse(range.step) };
          const nextError = parameterRangeError(next.min, next.max, next.step);
          setError(nextError);
          if (!nextError) onChange({ name, ...next, value: snapParameterValue(value, next.min, next.max, next.step) });
        }}>
          <div className="graphing-parameter-fields">
            {(["min", "max", "step"] as const).map((field) => (
              <label key={field}>{field === "min" ? "Min" : field === "max" ? "Max" : "Step"}
                <input type="number" step="any" aria-label={`${field === "min" ? "Minimum" : field === "max" ? "Maximum" : "Step"} for ${name}`} value={range[field]} onChange={(event) => setRange((previous) => ({ ...previous, [field]: event.target.value }))} />
              </label>
            ))}
          </div>
          {error && <p className="graphing-error" role="alert">{error}</p>}
          <button type="submit" aria-label={`Apply range for ${name}`}>Apply range</button>
        </form>
      </details>
    </section>
  );
}

export default function ParameterSliders({ parameters, onChange }: ParameterSlidersProps) {
  const nextName = PARAMETER_NAMES.find((name) => !parameters.some((parameter) => parameter.name === name));
  return (
    <section className="graphing-parameters" aria-label="Parameter sliders">
      <h3>Parameters</h3>
      <p className="graphing-hint">Add a slider for a, then use a*x^2 or sin(a*x). Use * for multiplication.</p>
      {parameters.map((parameter) => <ParameterSlider key={parameter.name} parameter={parameter} onChange={(next) => onChange(parameters.map((current) => current.name === next.name ? next : current))} onRemove={() => onChange(parameters.filter((current) => current.name !== parameter.name))} />)}
      <button type="button" className="graphing-add-button" disabled={!nextName} onClick={() => {
        if (nextName) onChange([...parameters, { name: nextName, value: 1, min: -5, max: 5, step: 0.1 }]);
      }}><Plus size={18} aria-hidden="true" />Add slider{nextName ? ` ${nextName}` : ""}</button>
    </section>
  );
}

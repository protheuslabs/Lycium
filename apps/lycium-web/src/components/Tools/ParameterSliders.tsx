"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Pause, Play, Plus, X } from "lucide-react";
import { advanceAnimatedParameter, PARAMETER_NAMES, parameterRangeError, snapParameterValue, type GraphParameter } from "./graphParameters";

type ParameterSlidersProps = {
  parameters: readonly GraphParameter[];
  onChange: (parameters: GraphParameter[]) => void;
  presentation?: boolean;
};

function ParameterSlider({ parameter, onChange, onRemove, playback, setPlayback, presentation = false }: {
  parameter: GraphParameter;
  onChange: (parameter: GraphParameter) => void;
  onRemove: () => void;
  presentation?: boolean;
  playback?: Playback;
  setPlayback: (next: Playback | null) => void;
}) {
  const id = useId();
  const [range, setRange] = useState({ min: String(parameter.min), max: String(parameter.max), step: String(parameter.step) });
  const [error, setError] = useState<string | null>(null);
  const [speed, setSpeed] = useState(1);
  const [direction, setDirection] = useState<1 | -1>(1);
  const { name, value, min, max, step } = parameter;

  return (
    <section className="graphing-parameter" aria-label={`Parameter ${name} controls`}>
      <div className="graphing-parameter-header">
        <label htmlFor={id}>{name} = <output htmlFor={id}>{value}</output></label>
        {!presentation && <button type="button" className="graphing-icon-button" aria-label={`Remove slider ${name}`} title={`Remove slider ${name}`} onClick={onRemove}><X size={18} aria-hidden="true" /></button>}
      </div>
      <input id={id} aria-label={`Parameter ${name}`} aria-valuetext={`${name} = ${value}`} type="range" min={min} max={max} step={step} value={value} onChange={(event) => { setPlayback(null); onChange({ ...parameter, value: Number(event.target.value) }); }} />
      <div className="graphing-animation-controls">
        <button type="button" className="graphing-animation-button" aria-label={`${playback ? "Pause" : "Play"} slider ${name}`} onClick={() => setPlayback(playback ? null : { speed, direction })}>{playback ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}{playback ? "Pause" : "Play"}</button>
        <label>Speed <select aria-label={`Animation speed for ${name}`} value={speed} onChange={(event) => { const next = Number(event.target.value); setSpeed(next); if (playback) setPlayback({ ...playback, speed: next }); }}><option value="0.5">0.5×</option><option value="1">1×</option><option value="2">2×</option></select></label>
        <button type="button" className="graphing-animation-button" aria-label={`Reverse slider ${name}`} onClick={() => { const next = direction === 1 ? -1 : 1; setDirection(next); if (playback) setPlayback({ ...playback, direction: next }); }}>Reverse</button>
      </div>
      <div className="graphing-parameter-limits" aria-hidden="true"><span>{min}</span><span>{max}</span></div>
      {!presentation && <details className="graphing-parameter-settings">
        <summary>Range and step</summary>
        <form noValidate onSubmit={(event) => {
          event.preventDefault();
          const parse = (input: string) => input.trim() === "" ? NaN : Number(input);
          const next = { min: parse(range.min), max: parse(range.max), step: parse(range.step) };
          const nextError = parameterRangeError(next.min, next.max, next.step);
          setError(nextError);
          if (!nextError) { setPlayback(null); onChange({ name, ...next, value: snapParameterValue(value, next.min, next.max, next.step) }); }
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
      </details>}
    </section>
  );
}

type Playback = { speed: number; direction: 1 | -1 };

export default function ParameterSliders({ parameters, onChange, presentation = false }: ParameterSlidersProps) {
  const [playing, setPlaying] = useState<Record<string, Playback>>({});
  const latest = useRef({ parameters, onChange });
  latest.current = { parameters, onChange };
  const positions = useRef<Record<string, number>>({});
  const hasPlaying = Object.keys(playing).length > 0;

  useEffect(() => {
    if (!hasPlaying) return;
    let frame = 0;
    let lastTime: number | undefined;
    const tick = (time: number) => {
      const elapsed = lastTime === undefined ? 0 : Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;
      const next = latest.current.parameters.map((parameter) => {
        const active = playing[parameter.name];
        if (!active) return parameter;
        const steps = Math.floor((parameter.max - parameter.min) / parameter.step + 1e-10);
        const current = positions.current[parameter.name] ?? (parameter.value - parameter.min) / parameter.step;
        const result = advanceAnimatedParameter(parameter, current, active.direction * active.speed * steps * elapsed / 5);
        positions.current[parameter.name] = result.position;
        return result.value === parameter.value ? parameter : { ...parameter, value: result.value };
      });
      if (next.some((parameter, index) => parameter !== latest.current.parameters[index])) latest.current.onChange(next);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, hasPlaying]);

  const setParameterPlayback = (name: string, next: Playback | null) => {
    setPlaying((previous) => {
      // Keep the reflected position when only speed changes.
      if (!next || !previous[name] || previous[name].direction !== next.direction) delete positions.current[name];
      const updated = { ...previous };
      if (next) updated[name] = next; else delete updated[name];
      return updated;
    });
  };
  const nextName = PARAMETER_NAMES.find((name) => !parameters.some((parameter) => parameter.name === name));
  return (
    <section className="graphing-parameters" aria-label="Parameter sliders">
      <h3>Parameters</h3>
      {!presentation && <p className="graphing-hint">Add a slider for a, then use a*x^2 or sin(a*x). Use * for multiplication.</p>}
      {parameters.map((parameter) => <ParameterSlider key={parameter.name} parameter={parameter} presentation={presentation} playback={playing[parameter.name]} setPlayback={(next) => setParameterPlayback(parameter.name, next)} onChange={(next) => onChange(parameters.map((current) => current.name === next.name ? next : current))} onRemove={() => { setParameterPlayback(parameter.name, null); onChange(parameters.filter((current) => current.name !== parameter.name)); }} />)}
      {!presentation && <button type="button" className="graphing-add-button" disabled={!nextName} onClick={() => {
        if (nextName) onChange([...parameters, { name: nextName, value: 1, min: -5, max: 5, step: 0.1 }]);
      }}><Plus size={18} aria-hidden="true" />Add slider{nextName ? ` ${nextName}` : ""}</button>}
    </section>
  );
}

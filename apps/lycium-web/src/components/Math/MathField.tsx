"use client";

import { useEffect, useRef, useState } from "react";
import type { MathfieldElement } from "mathlive";
import { convertAsciiMathToLatex } from "mathlive/ssr";
import "mathlive/fonts.css";
import "./mathField.css";

type ValueFormat = "latex" | "ascii-math";
type Props = {
  value: string; label: string; onChange: (value: string) => void;
  format?: ValueFormat; variant?: "graph" | "practice"; disabled?: boolean; invalid?: boolean;
  describedBy?: string; placeholder?: string; onValidityChange?: (invalid: boolean) => void;
};

const toLatex = (value: string, format: ValueFormat) => format === "ascii-math" ? convertAsciiMathToLatex(value) : value;

export default function MathField({ value, label, onChange, format = "latex", variant = "practice", disabled = false,
  invalid = false, describedBy, placeholder, onValidityChange }: Props) {
  const [fallback, setFallback] = useState(false);
  const [error, setError] = useState("");
  const hostRef = useRef<HTMLSpanElement>(null);
  const fieldRef = useRef<MathfieldElement | null>(null);
  const valueRef = useRef(value);
  const formatRef = useRef(format);
  const onChangeRef = useRef(onChange);
  const onValidityRef = useRef(onValidityChange);
  valueRef.current = value;
  formatRef.current = format;
  onChangeRef.current = onChange;
  onValidityRef.current = onValidityChange;

  useEffect(() => {
    let disposed = false;
    let field: MathfieldElement | undefined;
    let handleInput: (() => void) | undefined;
    void import("mathlive").then(({ MathfieldElement: Mathfield }) => {
      if (disposed || !hostRef.current) return;
      field = new Mathfield();
      field.mathVirtualKeyboardPolicy = "manual";
      field.setAttribute("aria-label", label);
      field.setValue(toLatex(valueRef.current, formatRef.current));
      field.disabled = disabled;
      handleInput = () => {
        if (!field) return;
        if (field.errors.length) {
          setError("Complete the mathematical expression before continuing.");
          onValidityRef.current?.(true);
          return;
        }
        const next = formatRef.current === "ascii-math"
          ? field.getValue("ascii-math").replace(/[∗×⋅]/g, "*")
          : field.getValue("latex");
        if (field.value && !next.trim()) {
          setError("This notation cannot be represented in the selected format.");
          onValidityRef.current?.(true);
          return;
        }
        setError("");
        onValidityRef.current?.(false);
        valueRef.current = next;
        onChangeRef.current(next);
      };
      field.addEventListener("input", handleInput);
      fieldRef.current = field;
      hostRef.current.replaceChildren(field);
    }).catch(() => {
      if (!disposed) {
        setFallback(true);
        setError("Could not open the math editor. Continue in plain text.");
      }
    });
    return () => {
      disposed = true;
      if (field && handleInput) field.removeEventListener("input", handleInput);
      field?.remove();
      fieldRef.current = null;
    };
  }, []);

  useEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    field.disabled = disabled;
    field.setAttribute("aria-label", label);
    field.setAttribute("aria-invalid", String(invalid || Boolean(error)));
    if (describedBy) field.setAttribute("aria-describedby", describedBy);
    else field.removeAttribute("aria-describedby");
    const next = toLatex(value, format);
    if (field.getValue("latex") !== next) field.setValue(next);
  }, [describedBy, disabled, error, format, invalid, label, value]);

  return <span className={`lycium-math-field lycium-math-field--${variant}`}>
    {fallback
      ? <input type="text" aria-label={label} aria-invalid={invalid} aria-describedby={describedBy} disabled={disabled}
          value={value} maxLength={500} placeholder={placeholder} autoComplete="off" autoCapitalize="off" spellCheck={false}
          onChange={event => onChange(event.target.value)} />
      : <span ref={hostRef} className="lycium-math-field-host" />}
    {error && <span className="lycium-math-field-error" role="alert">{error}</span>}
  </span>;
}

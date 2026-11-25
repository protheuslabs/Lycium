"use client";

import { useEffect, useRef, useState } from "react";
import type { MathfieldElement } from "mathlive";
import { convertAsciiMathToLatex } from "mathlive/ssr";
import "mathlive/fonts.css";

type Props = {
  value: string;
  label: string;
  invalid: boolean;
  describedBy?: string;
  onChange: (value: string) => void;
  onDraftError: (invalid: boolean) => void;
};

// Preserve the original expression on mount and import. Conversion only happens
// after an explicit user edit in the formatted field.
export default function MathExpressionField({ value, label, invalid, describedBy, onChange, onDraftError }: Props) {
  const [formatted, setFormatted] = useState(true);
  const [error, setError] = useState("");
  const hostRef = useRef<HTMLSpanElement>(null);
  const fieldRef = useRef<MathfieldElement | null>(null);
  const lastValue = useRef(value);
  const onChangeRef = useRef(onChange);
  const onDraftErrorRef = useRef(onDraftError);
  onChangeRef.current = onChange;
  onDraftErrorRef.current = onDraftError;

  useEffect(() => {
    if (!formatted) return;
    let disposed = false;
    let field: MathfieldElement | undefined;
    let handleInput: (() => void) | undefined;
    void import("mathlive").then(({ MathfieldElement: Mathfield }) => {
      if (disposed || !hostRef.current) return;
      field = new Mathfield();
      field.mathVirtualKeyboardPolicy = "manual";
      field.setAttribute("aria-label", label);
      field.setAttribute("aria-invalid", String(invalid));
      if (describedBy) field.setAttribute("aria-describedby", describedBy);
      field.setValue(convertAsciiMathToLatex(lastValue.current));
      handleInput = () => {
        if (!field) return;
        if (field.errors.length) {
          setError("Incomplete or unsupported math input. Finish editing before plotting.");
          onDraftErrorRef.current(true);
          return;
        }
        const next = field.getValue("ascii-math").replace(/[∗×⋅]/g, "*");
        // The field may contain syntax that cannot be represented as ASCIIMath.
        if (field.value && !next.trim()) {
          setError("This expression cannot be plotted. Try a different expression.");
          onDraftErrorRef.current(true);
          return;
        }
        setError("");
        onDraftErrorRef.current(false);
        lastValue.current = next;
        onChangeRef.current(next);
      };
      field.addEventListener("input", handleInput);
      fieldRef.current = field;
      hostRef.current.replaceChildren(field);
    }).catch(() => { if (!disposed) { setFormatted(false); setError("Could not open the math editor. Continue in plain text."); } });
    return () => {
      disposed = true;
      if (field && handleInput) field.removeEventListener("input", handleInput);
      field?.remove();
      fieldRef.current = null;
    };
  }, [formatted, label]);

  useEffect(() => {
    if (fieldRef.current) {
      fieldRef.current.setAttribute("aria-invalid", String(invalid || Boolean(error)));
      if (describedBy) fieldRef.current.setAttribute("aria-describedby", describedBy);
      else fieldRef.current.removeAttribute("aria-describedby");
      if (value !== lastValue.current) fieldRef.current.setValue(convertAsciiMathToLatex(value));
    }
    lastValue.current = value;
  }, [value, invalid, describedBy, error]);

  return <span className="graphing-math-editor">
    {formatted ? <span ref={hostRef} className="graphing-math-host" /> : <input type="text" aria-label={label} aria-invalid={invalid} aria-describedby={describedBy} value={value} maxLength={500} placeholder="e.g. y=2*x+1" autoComplete="off" autoCapitalize="off" spellCheck={false} onChange={(event) => onChange(event.target.value)} />}
    {error && <span className="graphing-error" role="alert">{error}</span>}
  </span>;
}

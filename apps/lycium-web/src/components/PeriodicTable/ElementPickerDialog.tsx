"use client";

import { X } from "lucide-react";
import PeriodicTable, { type PeriodicTableSelection } from "./PeriodicTable";

type Props = { open: boolean; selectedSymbols: readonly string[]; allowedSymbols?: readonly string[]; selection?: PeriodicTableSelection; onChange: (symbols: string[]) => void; onClose: () => void };

export default function ElementPickerDialog({ open, selectedSymbols, allowedSymbols, selection = "single", onChange, onClose }: Props) {
  if (!open) return null;
  return <div className="element-picker-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="element-picker-dialog" role="dialog" aria-modal="true" aria-labelledby="element-picker-title">
      <header><div><h2 id="element-picker-title">Choose an element</h2><p>Select from the complete periodic table.</p></div><button type="button" aria-label="Close periodic table" onClick={onClose}><X size={20} /></button></header>
      <PeriodicTable mode="picker" selection={selection} selectedSymbols={selectedSymbols} allowedSymbols={allowedSymbols} initialTab="properties" onSelectionChange={symbols => { onChange(symbols); if (selection === "single") onClose(); }} />
    </section>
  </div>;
}


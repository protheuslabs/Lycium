"use client";

import type { GraphLabels } from "./graphDocument";

export default function GraphLabelsPanel({ labels, onChange }: { labels: GraphLabels; onChange: (next: GraphLabels) => void }) {
  return <details className="graph-label-settings"><summary>Titles and annotations</summary>
    <div className="graph-label-fields">{([ ["title", "Graph title"], ["xTitle", "X axis title"], ["xUnit", "X axis unit"], ["yTitle", "Y axis title"], ["yUnit", "Y axis unit"] ] as const).map(([key, title]) => <label key={key}>{title}<input value={labels[key]} maxLength={100} onChange={(event) => onChange({ ...labels, [key]: event.target.value })} /></label>)}</div>
    {labels.annotations.map((annotation, index) => <div className="graph-annotation" key={annotation.id}>
      <label>Annotation {index + 1}<input aria-label={`Annotation ${index + 1} text`} value={annotation.text} maxLength={200} onChange={(event) => onChange({ ...labels, annotations: labels.annotations.map((item) => item.id === annotation.id ? { ...item, text: event.target.value } : item) })} /></label>
      {(["x", "y"] as const).map((axis) => <label key={axis}>{axis}<input type="number" step="any" aria-label={`Annotation ${index + 1} ${axis}`} defaultValue={annotation[axis]} onBlur={(event) => { const value = event.currentTarget.valueAsNumber; if (Number.isFinite(value)) onChange({ ...labels, annotations: labels.annotations.map((item) => item.id === annotation.id ? { ...item, [axis]: value } : item) }); else event.currentTarget.value = String(annotation[axis]); }} /></label>)}
      <button type="button" onClick={() => onChange({ ...labels, annotations: labels.annotations.filter((item) => item.id !== annotation.id) })} aria-label={`Remove annotation ${index + 1}`}>Remove</button>
    </div>)}
    <button type="button" disabled={labels.annotations.length >= 50} onClick={() => onChange({ ...labels, annotations: [...labels.annotations, { id: crypto.randomUUID(), x: 0, y: 0, text: "" }] })}>Add annotation</button>
  </details>;
}

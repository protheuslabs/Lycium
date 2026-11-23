"use client";

import { useRef, useState } from "react";
import { exponentialRegression, linearRegression, numericPoints, parseDatasetCsv, type GraphDataset } from "./graphDataset";

export default function DatasetPanel({ datasets, onChange, onFit, onUseLabels }: { datasets: GraphDataset[]; onChange: (datasets: GraphDataset[]) => void; onFit: (dataset: GraphDataset, equalScale: boolean) => void; onUseLabels: (dataset: GraphDataset) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const update = (id: string, changes: Partial<GraphDataset>) => onChange(datasets.map((item) => item.id === id ? { ...item, ...changes } : item));
  const add = (data?: Pick<GraphDataset, "xLabel" | "yLabel" | "rows">) => {
    if (datasets.length >= 20) { setError("A graph can contain at most 20 tables."); return; }
    const colors = ["#c2410c", "#9333ea", "#0e7490", "#be185d"];
    onChange([...datasets, { id: crypto.randomUUID(), name: `Dataset ${datasets.length + 1}`, xLabel: data?.xLabel ?? "x", yLabel: data?.yLabel ?? "y", rows: data?.rows ?? [{ x: "", y: "" }, { x: "", y: "" }, { x: "", y: "" }], color: colors[datasets.length % colors.length], visible: true, regression: false }]);
    setError("");
  };
  return <details className="graph-datasets"><summary>Data tables</summary>
    <p className="graphing-hint">Plot measurements and fit a model. CSV files need two numeric columns, with an optional header.</p>
    <div className="graph-dataset-actions"><button type="button" onClick={() => add()}>Add table</button><button type="button" onClick={() => inputRef.current?.click()}>Import CSV</button></div>
    <input ref={inputRef} type="file" accept=".csv,text/csv" className="sr-only" aria-label="Choose dataset CSV" onChange={(event) => {
      const file = event.currentTarget.files?.[0]; event.currentTarget.value = "";
      if (!file) return;
      if (file.size > 1_000_000) { setError("CSV files must be smaller than 1 MB."); return; }
      void file.text().then((text) => add(parseDatasetCsv(text.replace(/^\uFEFF/, "")))).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Could not read CSV."));
    }} />
    {error && <p className="graphing-error" role="alert">{error}</p>}
    {datasets.map((dataset) => {
      const points = numericPoints(dataset.rows), fit = linearRegression(points), exponential = exponentialRegression(points);
      return <section key={dataset.id} className="graph-dataset" aria-label={dataset.name}>
        <div className="graph-dataset-title"><span className="graphing-color" aria-hidden="true" style={{ backgroundColor: dataset.color }} /><input aria-label="Dataset name" value={dataset.name} maxLength={100} onChange={(event) => update(dataset.id, { name: event.target.value })} /><button type="button" onClick={() => onChange(datasets.filter((item) => item.id !== dataset.id))} aria-label={`Remove ${dataset.name}`}>Remove</button></div>
        <div className="graph-dataset-options"><label><input type="checkbox" checked={dataset.visible} onChange={(event) => update(dataset.id, { visible: event.target.checked })} />Show dataset</label><label><input type="checkbox" checked={dataset.regression} onChange={(event) => update(dataset.id, { regression: event.target.checked })} />Show fit</label></div>
        <div className="graph-dataset-options"><label><input type="checkbox" checked={dataset.connected ?? false} onChange={(event) => update(dataset.id, { connected: event.target.checked })} />Connect points</label><label>Model <select aria-label={`${dataset.name} regression model`} value={dataset.fitType ?? "linear"} onChange={(event) => update(dataset.id, { fitType: event.target.value === "exponential" ? "exponential" : "linear", regression: true })}><option value="linear">Linear</option><option value="exponential">Exponential</option></select></label></div>
        <table><thead><tr>{(["xLabel", "yLabel"] as const).map((key) => <th key={key}><input aria-label={`${key === "xLabel" ? "X" : "Y"} column label`} value={dataset[key]} maxLength={100} onChange={(event) => update(dataset.id, { [key]: event.target.value })} /></th>)}<th><span className="sr-only">Remove row</span></th></tr></thead>
          <tbody>{dataset.rows.map((row, index) => <tr key={index}>{(["x", "y"] as const).map((axis) => <td key={axis}><input type="number" step="any" aria-label={`${dataset.name} row ${index + 1} ${axis}`} value={row[axis]} onChange={(event) => update(dataset.id, { rows: dataset.rows.map((item, rowIndex) => rowIndex === index ? { ...item, [axis]: event.target.value } : item) })} /></td>)}<td><button type="button" className="graph-dataset-remove-row" aria-label={`Remove ${dataset.name} row ${index + 1}`} onClick={() => update(dataset.id, { rows: dataset.rows.filter((_, rowIndex) => rowIndex !== index) })}>×</button></td></tr>)}</tbody>
        </table>
        <div className="graph-dataset-actions"><button type="button" disabled={dataset.rows.length >= 1000} onClick={() => update(dataset.id, { rows: [...dataset.rows, { x: "", y: "" }] })}>Add row</button><button type="button" disabled={!points.length} onClick={() => onFit(dataset, false)}>Fit data in view</button><button type="button" disabled={!points.length} onClick={() => onFit(dataset, true)}>Fit equal scale</button></div>
        <button type="button" onClick={() => onUseLabels(dataset)}>Use column labels for axes</button>
        {dataset.regression && <p className="graphing-hint" role="status">{dataset.fitType === "exponential" ? exponential ? `y = ${Number(exponential.a.toPrecision(5))}e^(${Number(exponential.b.toPrecision(5))}x) · R² = ${Number(exponential.rSquared.toPrecision(5))} (log-space fit; R² in y)` : "An exponential fit needs positive y values and at least two different x values." : fit ? `y = ${Number(fit.slope.toPrecision(5))}x ${fit.intercept < 0 ? "−" : "+"} ${Number(Math.abs(fit.intercept).toPrecision(5))} · R² = ${Number(fit.rSquared.toPrecision(5))}` : "A linear fit needs at least two complete points with different x values."}</p>}
      </section>;
    })}
  </details>;
}

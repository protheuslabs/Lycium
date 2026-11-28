"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Download, Eraser, Focus, Hand, Minus, MousePointer2, Plus, Redo2, Trash2, Undo2, Upload } from "lucide-react";
import MoleculeCanvas, { type MoleculeEditorTool } from "./MoleculeCanvas";
import { molecularFormula, molarMass, moleculeWarnings } from "./moleculeChemistry";
import { EMPTY_MOLECULE, MOLECULE_EXAMPLES, parseMoleculeDocument, type MoleculeDocument, type MoleculeWorkspaceConfig } from "./moleculeModel";
import { elements } from "../../chemistry-core";
import ElementPickerDialog from "../PeriodicTable/ElementPickerDialog";
import "./moleculeStudio.css";

type Props = MoleculeWorkspaceConfig & { onChange?: (document: MoleculeDocument) => void };
type History = { past: MoleculeDocument[]; present: MoleculeDocument; future: MoleculeDocument[] };
const COMMON_ELEMENTS = ["H", "C", "N", "O", "F", "S", "P", "Cl", "Br"];
const PERIODIC_ELEMENTS = elements.map(item => item.symbol);
const clone = (document: MoleculeDocument): MoleculeDocument => JSON.parse(JSON.stringify(document)) as MoleculeDocument;

export function MoleculeWorkspace({ mode = "standalone", initialDocument = EMPTY_MOLECULE, allowedElements = PERIODIC_ELEMENTS,
  allowedBondOrders = [1, 2, 3], allowCharges = true, allowLonePairs = true, allowImportExport = mode === "standalone",
  showProperties = mode !== "assessment", onChange }: Props) {
  const [history, setHistory] = useState<History>(() => ({ past: [], present: clone(initialDocument), future: [] }));
  const [tool, setTool] = useState<MoleculeEditorTool>(mode === "readonly" ? "pan" : "select");
  const [element, setElement] = useState(allowedElements.includes("C") ? "C" : allowedElements[0] ?? "H");
  const [selectedAtomId, setSelectedAtomId] = useState<string | null>(null);
  const [selectedBondId, setSelectedBondId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [periodicOpen, setPeriodicOpen] = useState(false);
  const [propertiesOpen, setPropertiesOpen] = useState(true);
  const [message, setMessage] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const readonly = mode === "readonly";
  const document = history.present;
  const commit = (next: MoleculeDocument) => {
    setHistory(current => ({ past: [...current.past, current.present].slice(-100), present: next, future: [] }));
    onChange?.(next);
  };
  const undo = () => {
    if (!history.past.length) return;
    const next = { past: history.past.slice(0, -1), present: history.past.at(-1)!, future: [history.present, ...history.future] };
    setHistory(next); onChange?.(next.present);
  };
  const redo = () => {
    if (!history.future.length) return;
    const next = { past: [...history.past, history.present], present: history.future[0], future: history.future.slice(1) };
    setHistory(next); onChange?.(next.present);
  };
  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };
  const fitView = () => {
    if (!document.atoms.length) { resetView(); return; }
    const xs = document.atoms.map(atom => atom.x), ys = document.atoms.map(atom => atom.y);
    const width = Math.max(80, Math.max(...xs) - Math.min(...xs)), height = Math.max(80, Math.max(...ys) - Math.min(...ys));
    const nextZoom = Math.min(2.5, 620 / width, 360 / height);
    setZoom(nextZoom);
    setPan({ x: -((Math.min(...xs) + Math.max(...xs)) / 2) * nextZoom, y: -((Math.min(...ys) + Math.max(...ys)) / 2) * nextZoom });
  };
  const selectElement = (next: string) => { setElement(next); setTool("atom"); setPeriodicOpen(false); };
  const removeSelected = () => {
    if (selectedAtomId) {
      commit({ ...document, atoms: document.atoms.filter(atom => atom.id !== selectedAtomId), bonds: document.bonds.filter(bond => bond.source !== selectedAtomId && bond.target !== selectedAtomId) });
      setSelectedAtomId(null); return;
    }
    if (selectedBondId) { commit({ ...document, bonds: document.bonds.filter(bond => bond.id !== selectedBondId) }); setSelectedBondId(null); }
  };
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.matches("input, textarea, select, math-field")) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? redo() : undo(); }
      else if ((event.key === "Delete" || event.key === "Backspace") && (selectedAtomId || selectedBondId) && !readonly) { event.preventDefault(); removeSelected(); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });
  const formula = useMemo(() => molecularFormula(document), [document]);
  const mass = useMemo(() => molarMass(document), [document]);
  const warnings = useMemo(() => moleculeWarnings(document), [document]);
  const inconsistent = warnings.filter(item => item.status === "inconsistent"), unsupported = warnings.filter(item => item.status === "unsupported");
  const exportDocument = () => {
    const blob = new Blob([JSON.stringify(document, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob), anchor = window.document.createElement("a");
    anchor.href = url; anchor.download = `${formula === "—" ? "molecule" : formula}.lycium-molecule.json`; anchor.click(); URL.revokeObjectURL(url);
  };
  const importDocument = async (file: File) => {
    try { commit(parseMoleculeDocument(JSON.parse(await file.text()))); setMessage("Molecule imported."); resetView(); }
    catch { setMessage("That file is not a valid Lycium molecule document."); }
  };
  const toolButton = (value: MoleculeEditorTool, label: string, content: React.ReactNode, disabled = false) =>
    <button type="button" className="molecule-tool-button" data-active={tool === value} aria-pressed={tool === value} aria-label={label} title={label} disabled={disabled || readonly} onClick={() => setTool(value)}>{content}</button>;
  return <section className="molecule-studio" data-mode={mode}>
    <div className="molecule-command-bar">
      <div className="molecule-command-group">
        <button type="button" aria-label="Undo" title="Undo" disabled={!history.past.length || readonly} onClick={undo}><Undo2 size={17} /></button>
        <button type="button" aria-label="Redo" title="Redo" disabled={!history.future.length || readonly} onClick={redo}><Redo2 size={17} /></button>
        <button type="button" aria-label="Clear molecule" title="Clear molecule" disabled={!document.atoms.length || readonly} onClick={() => { commit(clone(EMPTY_MOLECULE)); setSelectedAtomId(null); setSelectedBondId(null); }}><Trash2 size={17} /></button>
      </div>
      <div className="molecule-command-group">
        <button type="button" aria-label="Zoom out" onClick={() => setZoom(value => Math.max(.4, value - .15))}><Minus size={17} /></button>
        <button type="button" aria-label="Zoom in" onClick={() => setZoom(value => Math.min(2.5, value + .15))}><Plus size={17} /></button>
        <button type="button" aria-label="Fit molecule to canvas" onClick={fitView}><Focus size={17} /></button>
      </div>
      {!readonly && mode !== "assessment" && <label className="molecule-example-picker">Example <select value="" onChange={event => { if (event.target.value) { commit(clone(MOLECULE_EXAMPLES[event.target.value])); setSelectedAtomId(null); setSelectedBondId(null); resetView(); } }}>
        <option value="">Choose…</option><option value="water">Water</option><option value="carbonDioxide">Carbon dioxide</option><option value="methane">Methane</option><option value="ammonia">Ammonia</option><option value="ammonium">Ammonium</option><option value="methanol">Methanol</option><option value="ethene">Ethene</option>
      </select></label>}
      {allowImportExport && <div className="molecule-file-actions">
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={event => { const file = event.target.files?.[0]; if (file) void importDocument(file); event.target.value = ""; }} />
        <button type="button" onClick={() => fileRef.current?.click()}><Upload size={15} /> Import</button>
        <button type="button" onClick={exportDocument}><Download size={15} /> Export</button>
      </div>}
    </div>
    <div className="molecule-editor-layout">
      <nav className="molecule-editing-rail" aria-label="Molecule editing tools">
        {toolButton("select", "Select and move atoms", <MousePointer2 size={19} />, readonly)}
        {toolButton("pan", "Pan canvas", <Hand size={19} />, false)}
        {toolButton("erase", "Erase atom or bond", <Eraser size={19} />)}
        {allowedBondOrders.map(order => toolButton(`bond-${order}` as MoleculeEditorTool, `${order === 1 ? "Single" : order === 2 ? "Double" : "Triple"} bond`, <span className={`molecule-bond-icon molecule-bond-icon-${order}`} />))}
        {allowLonePairs && toolButton("lone-pair", "Add lone electron pair", <span className="molecule-pair-icon">••</span>)}
        {allowCharges && toolButton("charge-plus", "Increase formal charge", <Plus size={18} />)}
        {allowCharges && toolButton("charge-minus", "Decrease formal charge", <Minus size={18} />)}
        <button type="button" className="molecule-tool-button" aria-label="Delete selected atom or bond" title="Delete selected atom or bond" disabled={(!selectedAtomId && !selectedBondId) || readonly} onClick={removeSelected}><Trash2 size={18} /></button>
      </nav>
      <div className="molecule-canvas-wrap">
        <MoleculeCanvas document={document} tool={tool} element={element} selectedAtomId={selectedAtomId} selectedBondId={selectedBondId} zoom={zoom} pan={pan} readonly={readonly}
          onChange={commit} onSelectAtom={setSelectedAtomId} onSelectBond={setSelectedBondId} onPanChange={setPan} onToolChange={setTool} />
        <span className="molecule-canvas-hint">Place atoms · select a bond tool, then choose two atoms · click lone pairs or charges onto an atom</span>
      </div>
      <aside className="molecule-side-panel">
        <section><h2>Elements</h2><div className="molecule-element-palette">{COMMON_ELEMENTS.filter(item => allowedElements.includes(item)).map(item =>
          <button type="button" key={item} data-active={tool === "atom" && element === item} onClick={() => selectElement(item)}>{item}</button>)}</div>
          <button type="button" className="molecule-periodic-toggle" onClick={() => setPeriodicOpen(true)} aria-expanded={periodicOpen}>Periodic table <ChevronRight size={14} /></button>
        </section>
        {showProperties && <section className="molecule-properties"><button type="button" className="molecule-panel-heading" onClick={() => setPropertiesOpen(value => !value)} aria-expanded={propertiesOpen}><span>Properties</span>{propertiesOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</button>
          {propertiesOpen && <div className="molecule-property-content"><dl><div><dt>Formula</dt><dd>{formula}</dd></div><div><dt>Molar mass</dt><dd>{mass ? `${mass.toFixed(3)} g/mol` : "—"}</dd></div><div><dt>Net charge</dt><dd>{document.atoms.reduce((sum, atom) => sum + atom.formalCharge, 0)}</dd></div></dl>
            <div className="molecule-validation" data-status={inconsistent.length ? "inconsistent" : unsupported.length ? "unsupported" : "consistent"}>{warnings.length ? <><strong>{inconsistent.length ? `${inconsistent.length} electron-count issue${inconsistent.length === 1 ? "" : "s"}` : "Validation is limited for this structure"}</strong><ul>{warnings.slice(0, 3).map(({ atom, message: warning }) => <li key={atom.id}>{warning}</li>)}</ul></> : <><strong>Structure check</strong><span>{document.atoms.length ? "Electron counts are consistent." : "Add atoms to begin."}</span></>}</div>
          </div>}
        </section>}
      </aside>
    </div>
    <ElementPickerDialog open={periodicOpen} selectedSymbols={[element]} allowedSymbols={allowedElements} onChange={symbols => { const next = symbols[0]; if (next) selectElement(next); }} onClose={() => setPeriodicOpen(false)} />
    <p className="molecule-status" role="status">{message}</p>
  </section>;
}

export default function MoleculeStudio() { return <MoleculeWorkspace />; }

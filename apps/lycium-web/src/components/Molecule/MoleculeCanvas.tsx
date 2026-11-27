"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { BondOrder, MoleculeDocument } from "./moleculeModel";

export type MoleculeEditorTool = "select" | "pan" | "erase" | "atom" | "bond-1" | "bond-2" | "bond-3" | "lone-pair" | "charge-plus" | "charge-minus";
type Props = {
  document: MoleculeDocument; tool: MoleculeEditorTool; element: string; selectedAtomId: string | null;
  zoom: number; pan: { x: number; y: number }; readonly?: boolean;
  onChange: (document: MoleculeDocument) => void; onSelectAtom: (id: string | null) => void;
  onPanChange: (pan: { x: number; y: number }) => void;
};

const nextId = (prefix: string, values: string[]) => `${prefix}${values.reduce((max, value) => Math.max(max, Number(value.replace(/\D/g, "")) || 0), 0) + 1}`;
const bondOffsets = (order: BondOrder) => order === 1 ? [0] : order === 2 ? [-4, 4] : [-7, 0, 7];

export default function MoleculeCanvas({ document, tool, element, selectedAtomId, zoom, pan, readonly = false, onChange, onSelectAtom, onPanChange }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [bondStart, setBondStart] = useState<string | null>(null);
  const dragRef = useRef<{ atomId?: string; x: number; y: number; panX: number; panY: number } | null>(null);
  const point = (event: ReactPointerEvent<SVGSVGElement>) => {
    const bounds = svgRef.current!.getBoundingClientRect();
    const svgX = (event.clientX - bounds.left) * 800 / bounds.width;
    const svgY = (event.clientY - bounds.top) * 520 / bounds.height;
    return { x: (svgX - 400 - pan.x) / zoom, y: (svgY - 260 - pan.y) / zoom };
  };
  const mutateAtom = (id: string, update: (atom: MoleculeDocument["atoms"][number]) => MoleculeDocument["atoms"][number]) =>
    onChange({ ...document, atoms: document.atoms.map(atom => atom.id === id ? update(atom) : atom) });
  const removeAtom = (id: string) => onChange({ ...document, atoms: document.atoms.filter(atom => atom.id !== id), bonds: document.bonds.filter(bond => bond.source !== id && bond.target !== id) });
  const handleAtomDown = (event: ReactPointerEvent<SVGGElement>, id: string) => {
    event.stopPropagation();
    if (readonly) return;
    if (tool === "erase") { removeAtom(id); onSelectAtom(null); return; }
    if (tool === "lone-pair") { mutateAtom(id, atom => ({ ...atom, lonePairs: (atom.lonePairs + 1) % 5 })); return; }
    if (tool === "charge-plus" || tool === "charge-minus") { mutateAtom(id, atom => ({ ...atom, formalCharge: atom.formalCharge + (tool === "charge-plus" ? 1 : -1) })); return; }
    if (tool.startsWith("bond-")) {
      if (!bondStart) { setBondStart(id); onSelectAtom(id); return; }
      if (bondStart === id) { setBondStart(null); return; }
      const order = Number(tool.at(-1)) as BondOrder;
      const existing = document.bonds.find(bond => (bond.source === bondStart && bond.target === id) || (bond.target === bondStart && bond.source === id));
      onChange(existing
        ? { ...document, bonds: document.bonds.map(bond => bond.id === existing.id ? { ...bond, order } : bond) }
        : { ...document, bonds: [...document.bonds, { id: nextId("b", document.bonds.map(bond => bond.id)), source: bondStart, target: id, order }] });
      setBondStart(null); onSelectAtom(id); return;
    }
    onSelectAtom(id);
    if (tool === "select") {
      const location = point(event as unknown as ReactPointerEvent<SVGSVGElement>);
      dragRef.current = { atomId: id, x: location.x, y: location.y, panX: 0, panY: 0 };
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  };
  const handleBackgroundDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (readonly) return;
    const location = point(event);
    if (tool === "atom") {
      const id = nextId("a", document.atoms.map(atom => atom.id));
      onChange({ ...document, atoms: [...document.atoms, { id, element, formalCharge: 0, lonePairs: 0, ...location }] });
      onSelectAtom(id);
    } else if (tool === "pan") {
      dragRef.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
      event.currentTarget.setPointerCapture(event.pointerId);
    } else { onSelectAtom(null); setBondStart(null); }
  };
  const handleMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.atomId) {
      const location = point(event);
      const dx = location.x - drag.x, dy = location.y - drag.y;
      mutateAtom(drag.atomId, atom => ({ ...atom, x: atom.x + dx, y: atom.y + dy }));
      drag.x = location.x; drag.y = location.y;
    } else {
      const bounds = svgRef.current!.getBoundingClientRect();
      onPanChange({ x: drag.panX + (event.clientX - drag.x) * 800 / bounds.width, y: drag.panY + (event.clientY - drag.y) * 520 / bounds.height });
    }
  };
  return <svg ref={svgRef} className="molecule-canvas" viewBox="0 0 800 520" role="application" aria-label="Molecule construction canvas"
    onPointerDown={handleBackgroundDown} onPointerMove={handleMove} onPointerUp={() => { dragRef.current = null; }} onPointerCancel={() => { dragRef.current = null; }}>
    <defs><pattern id="molecule-grid" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" /></pattern></defs>
    <rect width="800" height="520" className="molecule-grid" />
    <g transform={`translate(${400 + pan.x} ${260 + pan.y}) scale(${zoom})`}>
      {document.bonds.map(bond => {
        const source = document.atoms.find(atom => atom.id === bond.source), target = document.atoms.find(atom => atom.id === bond.target);
        if (!source || !target) return null;
        const dx = target.x - source.x, dy = target.y - source.y, length = Math.hypot(dx, dy) || 1, nx = -dy / length, ny = dx / length;
        return <g key={bond.id} className="molecule-bond">{bondOffsets(bond.order).map(offset => <line key={offset} x1={source.x + nx * offset} y1={source.y + ny * offset} x2={target.x + nx * offset} y2={target.y + ny * offset} />)}</g>;
      })}
      {document.atoms.map(atom => {
        const charge = atom.formalCharge === 0 ? "" : atom.formalCharge === 1 ? "+" : atom.formalCharge === -1 ? "−" : `${Math.abs(atom.formalCharge)}${atom.formalCharge > 0 ? "+" : "−"}`;
        const pairPositions = [[0, -27], [28, 0], [0, 28], [-28, 0]];
        return <g key={atom.id} className="molecule-atom" data-selected={selectedAtomId === atom.id || bondStart === atom.id} transform={`translate(${atom.x} ${atom.y})`}
          onPointerDown={event => handleAtomDown(event, atom.id)}>
          <circle r="23" className="molecule-atom-hit" />
          <text className={`molecule-atom-label molecule-element-${atom.element.toLowerCase()}`} textAnchor="middle" dominantBaseline="central">{atom.element}</text>
          {charge && <text className="molecule-atom-charge" x="15" y="-16">{charge}</text>}
          {pairPositions.slice(0, atom.lonePairs).map(([x, y], index) => <g key={index} className="molecule-lone-pair" transform={`translate(${x} ${y}) rotate(${index % 2 ? 90 : 0})`}><circle cx="-3" r="2" /><circle cx="3" r="2" /></g>)}
        </g>;
      })}
    </g>
    {!document.atoms.length && <text x="400" y="260" className="molecule-empty-label" textAnchor="middle">Choose an element, then click to place an atom</text>}
  </svg>;
}

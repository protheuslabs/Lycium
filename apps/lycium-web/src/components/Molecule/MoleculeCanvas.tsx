"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { connectedAtomIds, type BondOrder, type MoleculeDocument } from "./moleculeModel";
import { atomVisual, lonePairPositions, type MoleculeDisplayMode } from "./moleculeAppearance";

export type MoleculeEditorTool = "select" | "pan" | "erase" | "atom" | "bond-1" | "bond-2" | "bond-3" | "lone-pair" | "charge-plus" | "charge-minus";
type Props = {
  document: MoleculeDocument; tool: MoleculeEditorTool; element: string; selectedAtomId: string | null; selectedBondId: string | null;
  zoom: number; pan: { x: number; y: number }; displayMode: MoleculeDisplayMode; readonly?: boolean; directBondOrder: BondOrder | null;
  onChange: (document: MoleculeDocument) => void; onSelectAtom: (id: string | null) => void; onSelectBond: (id: string | null) => void;
  onPanChange: (pan: { x: number; y: number }) => void; onToolChange: (tool: MoleculeEditorTool) => void;
};

const nextId = (prefix: string, values: string[]) => `${prefix}${values.reduce((max, value) => Math.max(max, Number(value.replace(/\D/g, "")) || 0), 0) + 1}`;
const bondOffsets = (order: BondOrder) => order === 1 ? [0] : order === 2 ? [-4, 4] : [-7, 0, 7];

export default function MoleculeCanvas({ document, tool, element, selectedAtomId, selectedBondId, zoom, pan, displayMode, readonly = false, directBondOrder, onChange, onSelectAtom, onSelectBond, onPanChange, onToolChange }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [bondStart, setBondStart] = useState<string | null>(null);
  const [placementPreview, setPlacementPreview] = useState<{ x: number; y: number } | null>(null);
  const [dragOffset, setDragOffset] = useState<{ atomIds: string[]; dx: number; dy: number } | null>(null);
  const [bondPreview, setBondPreview] = useState<{ sourceId: string; x: number; y: number } | null>(null);
  const dragRef = useRef<{ atomIds?: string[]; x: number; y: number; panX: number; panY: number } | null>(null);
  const bondDragRef = useRef<{ sourceId: string; clientX: number; clientY: number; order: BondOrder; createOnEmpty: boolean } | null>(null);
  const point = (event: ReactPointerEvent<SVGSVGElement>) => {
    const bounds = svgRef.current!.getBoundingClientRect();
    const scale = Math.min(bounds.width / 800, bounds.height / 520);
    const offsetX = (bounds.width - 800 * scale) / 2, offsetY = (bounds.height - 520 * scale) / 2;
    const svgX = (event.clientX - bounds.left - offsetX) / scale;
    const svgY = (event.clientY - bounds.top - offsetY) / scale;
    return { x: (svgX - 400 - pan.x) / zoom, y: (svgY - 260 - pan.y) / zoom };
  };
  const mutateAtom = (id: string, update: (atom: MoleculeDocument["atoms"][number]) => MoleculeDocument["atoms"][number]) =>
    onChange({ ...document, atoms: document.atoms.map(atom => atom.id === id ? update(atom) : atom) });
  useEffect(() => { if (tool !== "atom") setPlacementPreview(null); }, [tool]);
  useEffect(() => {
    if (!tool.startsWith("bond-") || (bondStart && !document.atoms.some(atom => atom.id === bondStart))) setBondStart(null);
  }, [bondStart, document.atoms, tool]);
  const removeAtom = (id: string) => onChange({ ...document, atoms: document.atoms.filter(atom => atom.id !== id), bonds: document.bonds.filter(bond => bond.source !== id && bond.target !== id) });
  const handleAtomDown = (event: ReactPointerEvent<SVGGElement>, id: string) => {
    event.stopPropagation();
    if (readonly || directBondOrder === null) return;
    if (tool === "erase") { removeAtom(id); onSelectAtom(null); return; }
    if (tool === "lone-pair") { mutateAtom(id, atom => ({ ...atom, lonePairs: (atom.lonePairs + 1) % 5 })); return; }
    if (tool === "charge-plus" || tool === "charge-minus") { mutateAtom(id, atom => ({ ...atom, formalCharge: atom.formalCharge + (tool === "charge-plus" ? 1 : -1) })); return; }
    if (tool.startsWith("bond-")) {
      if (!bondStart) { setBondStart(id); onSelectAtom(id); bondDragRef.current = { sourceId: id, clientX: event.clientX, clientY: event.clientY, order: Number(tool.at(-1)) as BondOrder, createOnEmpty: true }; event.currentTarget.setPointerCapture(event.pointerId); return; }
      if (bondStart === id) { setBondStart(null); bondDragRef.current = null; setBondPreview(null); return; }
      const order = Number(tool.at(-1)) as BondOrder;
      const existing = document.bonds.find(bond => (bond.source === bondStart && bond.target === id) || (bond.target === bondStart && bond.source === id));
      onChange(existing
        ? { ...document, bonds: document.bonds.map(bond => bond.id === existing.id ? { ...bond, order } : bond) }
        : { ...document, bonds: [...document.bonds, { id: nextId("b", document.bonds.map(bond => bond.id)), source: bondStart, target: id, order }] });
      setBondStart(null); bondDragRef.current = null; setBondPreview(null); onSelectAtom(id); return;
    }
    onSelectAtom(id);
    onSelectBond(null);
    if (tool === "select") {
      const location = point(event as unknown as ReactPointerEvent<SVGSVGElement>);
      dragRef.current = { atomIds: connectedAtomIds(document, id), x: location.x, y: location.y, panX: 0, panY: 0 };
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  };
  const beginHandleBond = (event: ReactPointerEvent<SVGCircleElement>, sourceId: string) => {
    event.stopPropagation();
    const order = directBondOrder;
    if (readonly || order === null) return;
    const atom = document.atoms.find(item => item.id === sourceId);
    if (!atom) return;
    bondDragRef.current = { sourceId, clientX: event.clientX, clientY: event.clientY, order, createOnEmpty: false };
    setBondStart(sourceId);
    setBondPreview({ sourceId, x: atom.x, y: atom.y });
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const handleBondDown = (event: ReactPointerEvent<SVGGElement>, id: string) => {
    event.stopPropagation();
    if (readonly) return;
    if (tool === "erase") { onChange({ ...document, bonds: document.bonds.filter(bond => bond.id !== id) }); onSelectBond(null); return; }
    if (tool === "select") { onSelectAtom(null); onSelectBond(id); }
  };
  const handleBackgroundDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (readonly && tool !== "pan") return;
    const location = point(event);
    if (tool === "atom") {
      const id = nextId("a", document.atoms.map(atom => atom.id));
      onChange({ ...document, atoms: [...document.atoms, { id, element, formalCharge: 0, lonePairs: 0, ...location }] });
      onSelectAtom(id);
      onSelectBond(null);
      setPlacementPreview(null);
      onToolChange("select");
    } else if (tool === "pan") {
      dragRef.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
      event.currentTarget.setPointerCapture(event.pointerId);
    } else { onSelectAtom(null); onSelectBond(null); setBondStart(null); }
  };
  const handleMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (tool === "atom") setPlacementPreview(point(event));
    if (bondDragRef.current) {
      const location = point(event);
      if (Math.hypot(event.clientX - bondDragRef.current.clientX, event.clientY - bondDragRef.current.clientY) > 7) setBondPreview({ sourceId: bondDragRef.current.sourceId, ...location });
    }
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.atomIds) {
      const location = point(event);
      const dx = location.x - drag.x, dy = location.y - drag.y;
      setDragOffset({ atomIds: drag.atomIds, dx, dy });
    } else {
      const bounds = svgRef.current!.getBoundingClientRect();
      onPanChange({ x: drag.panX + (event.clientX - drag.x) * 800 / bounds.width, y: drag.panY + (event.clientY - drag.y) * 520 / bounds.height });
    }
  };
  const finishDrag = (event?: ReactPointerEvent<SVGSVGElement>, cancelled = false) => {
    if (!cancelled && event && bondDragRef.current && bondPreview) {
      const bondId = nextId("b", document.bonds.map(bond => bond.id));
      const order = bondDragRef.current.order;
      const target = document.atoms.find(atom => atom.id !== bondDragRef.current?.sourceId && Math.hypot(atom.x - bondPreview.x, atom.y - bondPreview.y) <= atomVisual(atom.element, displayMode).radius + 12);
      if (target) {
        const existing = document.bonds.find(bond => (bond.source === bondDragRef.current?.sourceId && bond.target === target.id) || (bond.target === bondDragRef.current?.sourceId && bond.source === target.id));
        onChange(existing ? { ...document, bonds: document.bonds.map(bond => bond.id === existing.id ? { ...bond, order } : bond) } : { ...document, bonds: [...document.bonds, { id: bondId, source: bondDragRef.current.sourceId, target: target.id, order }] });
        onSelectAtom(target.id);
      } else if (bondDragRef.current.createOnEmpty) {
        const id = nextId("a", document.atoms.map(atom => atom.id));
        onChange({ ...document, atoms: [...document.atoms, { id, element, formalCharge: 0, lonePairs: 0, x: bondPreview.x, y: bondPreview.y }], bonds: [...document.bonds, { id: bondId, source: bondDragRef.current.sourceId, target: id, order }] });
        onSelectAtom(id);
      }
      onSelectBond(null); setBondStart(null);
    }
    bondDragRef.current = null;
    setBondPreview(null);
    const drag = dragRef.current;
    if (drag?.atomIds && dragOffset && (dragOffset.dx || dragOffset.dy)) {
      const moving = new Set(drag.atomIds);
      onChange({ ...document, atoms: document.atoms.map(atom => moving.has(atom.id) ? { ...atom, x: atom.x + dragOffset.dx, y: atom.y + dragOffset.dy } : atom) });
    }
    dragRef.current = null;
    setDragOffset(null);
  };
  const position = (atom: MoleculeDocument["atoms"][number]) => dragOffset?.atomIds.includes(atom.id) ? { x: atom.x + dragOffset.dx, y: atom.y + dragOffset.dy } : atom;
  return <svg ref={svgRef} className="molecule-canvas" data-display-mode={displayMode} viewBox="0 0 800 520" role="application" aria-label="Molecule construction canvas"
    onPointerDown={handleBackgroundDown} onPointerMove={handleMove} onPointerUp={event => finishDrag(event)} onPointerCancel={event => finishDrag(event, true)}>
    <defs><pattern id="molecule-grid" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" /></pattern></defs>
    <rect width="800" height="520" className="molecule-grid" />
    <g transform={`translate(${400 + pan.x} ${260 + pan.y}) scale(${zoom})`}>
      {document.bonds.map(bond => {
        const sourceAtom = document.atoms.find(atom => atom.id === bond.source), targetAtom = document.atoms.find(atom => atom.id === bond.target);
        if (!sourceAtom || !targetAtom) return null;
        const source = position(sourceAtom), target = position(targetAtom);
        const dx = target.x - source.x, dy = target.y - source.y, length = Math.hypot(dx, dy) || 1, nx = -dy / length, ny = dx / length;
        const ux = dx / length, uy = dy / length, sourceRadius = atomVisual(sourceAtom.element, displayMode).radius, targetRadius = atomVisual(targetAtom.element, displayMode).radius;
        const x1 = source.x + ux * sourceRadius, y1 = source.y + uy * sourceRadius, x2 = target.x - ux * targetRadius, y2 = target.y - uy * targetRadius;
        return <g key={bond.id} className="molecule-bond" data-selected={selectedBondId === bond.id} onPointerDown={event => handleBondDown(event, bond.id)}><line className="molecule-bond-hit" x1={source.x} y1={source.y} x2={target.x} y2={target.y} />{bondOffsets(bond.order).map(offset => <line key={offset} x1={x1 + nx * offset} y1={y1 + ny * offset} x2={x2 + nx * offset} y2={y2 + ny * offset} />)}</g>;
      })}
      {bondPreview && (() => { const source = document.atoms.find(atom => atom.id === bondPreview.sourceId); return source ? <line className="molecule-bond-preview" x1={source.x} y1={source.y} x2={bondPreview.x} y2={bondPreview.y} /> : null; })()}
      {document.atoms.map(atom => {
        const display = position(atom);
        const visual = atomVisual(atom.element, displayMode);
        const charge = atom.formalCharge === 0 ? "" : atom.formalCharge === 1 ? "+" : atom.formalCharge === -1 ? "−" : `${Math.abs(atom.formalCharge)}${atom.formalCharge > 0 ? "+" : "−"}`;
        const pairPositions = lonePairPositions(document, atom, visual.radius);
        return <g key={atom.id} className="molecule-atom" data-selected={selectedAtomId === atom.id || bondStart === atom.id} transform={`translate(${display.x} ${display.y})`}
          style={{ "--atom-color": visual.color, "--atom-label-color": visual.labelColor } as CSSProperties}
          onPointerDown={event => handleAtomDown(event, atom.id)}>
          <circle r={Math.max(27, visual.radius)} className="molecule-atom-hit" />
          <circle r={visual.radius} className="molecule-atom-body" />
          <text className="molecule-atom-label" textAnchor="middle" dominantBaseline="central">{atom.element}</text>
          {charge && <text className="molecule-atom-charge" x={visual.radius * .72} y={-visual.radius * .68}>{charge}</text>}
          {pairPositions.map(({ x, y, angle }, index) => <g key={index} className="molecule-lone-pair" transform={`translate(${x} ${y}) rotate(${angle * 180 / Math.PI + 90})`}><circle cx="-3" r="2" /><circle cx="3" r="2" /></g>)}
          {directBondOrder !== null && (selectedAtomId === atom.id || bondStart === atom.id || (bondPreview && atom.id !== bondPreview.sourceId)) && !readonly && [0, 90, 180, 270].map(angle => { const radians = angle * Math.PI / 180, distance = visual.radius + 9; return <circle key={angle} className="molecule-connection-handle" data-target={bondPreview && atom.id !== bondPreview.sourceId} cx={Math.cos(radians) * distance} cy={Math.sin(radians) * distance} r={bondPreview && atom.id !== bondPreview.sourceId ? 4.5 : 3.5} onPointerDown={event => beginHandleBond(event, atom.id)} />; })}
        </g>;
      })}
      {tool === "atom" && placementPreview && <g className="molecule-placement-preview" transform={`translate(${placementPreview.x} ${placementPreview.y})`} aria-hidden="true">
        <circle r={atomVisual(element, displayMode).radius} /><text textAnchor="middle" dominantBaseline="central">{element}</text>
      </g>}
    </g>
    {!document.atoms.length && <text x="400" y="260" className="molecule-empty-label" textAnchor="middle">Choose an element, then click to place one atom</text>}
  </svg>;
}

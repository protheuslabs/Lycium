"use client";

import { useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { elementProperty, elements, getElement, searchElements, type ChemicalElement, type ElementFamily, type ElementPropertyKey } from "../../chemistry-core";
import "./periodicTable.css";

export type PeriodicTableMode = "explore" | "reference" | "picker" | "assessment" | "readonly" | "presentation";
export type PeriodicTableSelection = "single" | "multiple";
export type PeriodicTableTab = "properties" | "electrons" | "trends" | "compare";
export interface PeriodicTableState { selectedSymbols: string[]; tab: PeriodicTableTab; trend: ElementPropertyKey; query: string }
export interface PeriodicTableProps {
  mode?: PeriodicTableMode;
  selection?: PeriodicTableSelection;
  selectedSymbols?: readonly string[];
  defaultSelectedSymbols?: readonly string[];
  allowedSymbols?: readonly string[];
  disabledSymbols?: readonly string[];
  highlightedSymbols?: readonly string[];
  visibleProperties?: readonly ElementPropertyKey[];
  initialTab?: PeriodicTableTab;
  readOnly?: boolean;
  showSearch?: boolean;
  onSelectionChange?: (symbols: string[], elements: ChemicalElement[]) => void;
  onStateChange?: (state: PeriodicTableState) => void;
  className?: string;
}

const FAMILY_LABELS = new Map(elements.map(element => [element.family, element.familyLabel]));
const FAMILY_ORDER: ElementFamily[] = ["nonmetal", "alkali-metal", "alkaline-earth", "transition-metal", "post-transition-metal", "metalloid", "halogen", "noble-gas", "lanthanide", "actinide"];
const TREND_LABELS: Record<ElementPropertyKey, { label: string; unit: string }> = {
  atomicWeight: { label: "Atomic weight", unit: "u" }, electronegativity: { label: "Electronegativity", unit: "Pauling" },
  atomicRadius: { label: "Atomic radius", unit: "pm" }, firstIonizationEnergy: { label: "First ionization energy", unit: "eV" },
  electronAffinity: { label: "Electron affinity", unit: "eV" }, density: { label: "Density", unit: "g/cm³" },
  meltingPoint: { label: "Melting point", unit: "K" }, boilingPoint: { label: "Boiling point", unit: "K" },
};
const DEFAULT_PROPERTIES = Object.keys(TREND_LABELS) as ElementPropertyKey[];

function ShellDiagram({ element }: { element: ChemicalElement }) {
  const size = 108, center = size / 2;
  return <figure className="periodic-shell-diagram"><svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${element.name} electron shells`}>
    {element.shells.map((count, shell) => {
      const radius = 14 + shell * 6.3;
      return <g key={shell}><circle className="periodic-shell-ring" cx={center} cy={center} r={radius} />{Array.from({ length: count }, (_, index) => {
        const angle = (Math.PI * 2 * index / count) - Math.PI / 2;
        return <circle className="periodic-shell-electron" key={index} cx={center + Math.cos(angle) * radius} cy={center + Math.sin(angle) * radius} r="2.1" />;
      })}</g>;
    })}
    <circle className="periodic-shell-nucleus" cx={center} cy={center} r="7" /><text x={center} y={center + 3}>{element.symbol}</text>
  </svg><figcaption>Electron shells</figcaption></figure>;
}

function formatProperty(element: ChemicalElement, key: ElementPropertyKey) {
  if (key === "atomicWeight") return `${element.atomicWeight.display} u`;
  const value = elementProperty(element, key);
  return value === null ? "Not available" : `${value.toLocaleString()} ${TREND_LABELS[key].unit}`;
}

export default function PeriodicTable({ mode = "explore", selection = "single", selectedSymbols, defaultSelectedSymbols = ["O"], allowedSymbols,
  disabledSymbols = [], highlightedSymbols = [], visibleProperties = DEFAULT_PROPERTIES, initialTab = "properties", readOnly = mode === "readonly",
  showSearch = mode !== "presentation", onSelectionChange, onStateChange, className = "" }: PeriodicTableProps) {
  const [internalSelection, setInternalSelection] = useState<string[]>([...defaultSelectedSymbols]);
  const [tab, setTab] = useState<PeriodicTableTab>(initialTab);
  const [trend, setTrend] = useState<ElementPropertyKey>(visibleProperties[0] ?? "atomicWeight");
  const [query, setQuery] = useState("");
  const [hovered, setHovered] = useState<string | null>(null);
  const selected = selectedSymbols ? [...selectedSymbols] : internalSelection;
  const allowed = useMemo(() => allowedSymbols ? new Set(allowedSymbols) : null, [allowedSymbols]);
  const disabled = useMemo(() => new Set(disabledSymbols), [disabledSymbols]);
  const highlighted = useMemo(() => new Set(highlightedSymbols), [highlightedSymbols]);
  const cells = useRef(new Map<number, HTMLButtonElement>());
  const inspected = getElement(hovered ?? selected.at(-1) ?? "O") ?? elements[7];
  const comparison = selected.map(symbol => getElement(symbol)).filter((element): element is ChemicalElement => Boolean(element)).slice(-3);
  const trendValues = elements.map(element => elementProperty(element, trend)).filter((value): value is number => value !== null);
  const trendMin = Math.min(...trendValues), trendMax = Math.max(...trendValues);
  const matches = query ? searchElements(query, allowedSymbols).slice(0, 8) : [];

  const emit = (symbols: string[], nextTab = tab, nextTrend = trend, nextQuery = query) => {
    if (!selectedSymbols) setInternalSelection(symbols);
    onSelectionChange?.(symbols, symbols.map(symbol => getElement(symbol)).filter((element): element is ChemicalElement => Boolean(element)));
    onStateChange?.({ selectedSymbols: symbols, tab: nextTab, trend: nextTrend, query: nextQuery });
  };
  const choose = (element: ChemicalElement) => {
    if (readOnly || (allowed && !allowed.has(element.symbol)) || disabled.has(element.symbol)) return;
    const next = selection === "multiple" ? (selected.includes(element.symbol) ? selected.filter(symbol => symbol !== element.symbol) : [...selected, element.symbol]) : [element.symbol];
    emit(next);
  };
  const setActiveTab = (next: PeriodicTableTab) => { setTab(next); onStateChange?.({ selectedSymbols: selected, tab: next, trend, query }); };
  const setActiveTrend = (next: ElementPropertyKey) => { setTrend(next); onStateChange?.({ selectedSymbols: selected, tab, trend: next, query }); };
  const moveFocus = (element: ChemicalElement, direction: "left" | "right" | "up" | "down") => {
    const candidates = elements.filter(item => direction === "left" || direction === "right" ? item.row === element.row : item.column === element.column);
    const sorted = candidates.sort((a, b) => direction === "left" || direction === "right" ? a.column - b.column : a.row - b.row);
    const index = sorted.findIndex(item => item.atomicNumber === element.atomicNumber);
    cells.current.get(sorted[index + (direction === "left" || direction === "up" ? -1 : 1)]?.atomicNumber ?? -1)?.focus();
  };

  return <section className={`periodic-table ${className}`.trim()} data-mode={mode}>
    <div className="periodic-toolbar">
      <nav aria-label="Periodic table views">{(["properties", "electrons", "trends", "compare"] as const).map(item => <button key={item} type="button" data-active={tab === item} onClick={() => setActiveTab(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}</nav>
      {showSearch && <div className="periodic-search"><Search size={16} /><input aria-label="Search elements" value={query} placeholder="Search name, symbol, or number" onChange={event => { setQuery(event.target.value); onStateChange?.({ selectedSymbols: selected, tab, trend, query: event.target.value }); }} />
        {matches.length > 0 && <div className="periodic-search-results">{matches.map(element => <button type="button" key={element.symbol} onClick={() => { choose(element); setQuery(""); }}><b>{element.symbol}</b><span>{element.name}</span><small>{element.atomicNumber}</small></button>)}</div>}</div>}
    </div>

    {tab === "trends" && <div className="periodic-trend-controls"><label>Color by <select value={trend} onChange={event => setActiveTrend(event.target.value as ElementPropertyKey)}>{visibleProperties.map(key => <option key={key} value={key}>{TREND_LABELS[key].label}</option>)}</select></label><div className="periodic-trend-legend"><span>{trendMin.toLocaleString()}</span><i /><span>{trendMax.toLocaleString()} {TREND_LABELS[trend].unit}</span><em>Hatched = unavailable</em></div></div>}

    <div className="periodic-grid-wrap"><div className="periodic-grid" role="grid" aria-label="Periodic table of elements">
      {Array.from({ length: 18 }, (_, index) => <span className="periodic-group-label" style={{ gridColumn: index + 2, gridRow: 1 }} key={`g${index}`}>{index + 1}</span>)}
      {Array.from({ length: 7 }, (_, index) => <span className="periodic-period-label" style={{ gridColumn: 1, gridRow: index + 2 }} key={`p${index}`}>{index + 1}</span>)}
      {elements.map(element => {
        const value = elementProperty(element, trend), ratio = value === null ? null : (value - trendMin) / Math.max(trendMax - trendMin, 1);
        const unavailable = Boolean(allowed && !allowed.has(element.symbol));
        return <button type="button" role="gridcell" ref={node => { if (node) cells.current.set(element.atomicNumber, node); }} key={element.symbol}
          className="periodic-element-cell" data-family={element.family} data-selected={selected.includes(element.symbol)} data-highlighted={highlighted.has(element.symbol)} data-unavailable={unavailable || disabled.has(element.symbol)} data-missing={tab === "trends" && value === null}
          style={{ gridColumn: element.column + 1, gridRow: element.row + 1, ...(tab === "trends" && ratio !== null ? { "--trend-ratio": ratio } : {}) } as React.CSSProperties}
          aria-label={`${element.name}, atomic number ${element.atomicNumber}`} aria-pressed={selected.includes(element.symbol)} disabled={disabled.has(element.symbol)} onMouseEnter={() => setHovered(element.symbol)} onMouseLeave={() => setHovered(null)} onFocus={() => setHovered(element.symbol)} onClick={() => choose(element)}
          onKeyDown={event => { const map = { ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down" } as const; const direction = map[event.key as keyof typeof map]; if (direction) { event.preventDefault(); moveFocus(element, direction); } }}>
          <small>{element.atomicNumber}</small><strong>{element.symbol}</strong><span>{mode === "presentation" ? "" : element.name}</span>
        </button>;
      })}
      <span className="periodic-series-label periodic-lanthanide-label">Lanthanides</span><span className="periodic-series-label periodic-actinide-label">Actinides</span>
    </div></div>

    <div className="periodic-family-legend">{FAMILY_ORDER.map(family => <span key={family} data-family={family}><i />{FAMILY_LABELS.get(family)}</span>)}</div>

    {tab === "compare" ? <div className="periodic-compare-panel">{comparison.length < 2 && <p>Select two or three elements to compare. Turn on multiple selection when embedding the table as a comparison picker.</p>}{comparison.map(element => <article key={element.symbol}><header><b>{element.symbol}</b><div><h2>{element.name}</h2><span>Atomic number {element.atomicNumber}</span></div></header><dl>{visibleProperties.map(key => <div key={key}><dt>{TREND_LABELS[key].label}</dt><dd>{formatProperty(element, key)}</dd></div>)}</dl></article>)}</div>
    : <div className="periodic-inspector"><div className="periodic-element-identity"><span data-family={inspected.family}>{inspected.atomicNumber}<strong>{inspected.symbol}</strong><small>{inspected.atomicWeight.display}</small></span><div><h2>{inspected.name}</h2><p>{inspected.group ? `Group ${inspected.group} · ` : ""}Period {inspected.period} · {inspected.standardState ?? "State unavailable"}</p><p>{inspected.electronConfiguration}</p></div></div>
      {tab === "electrons" ? <><ShellDiagram element={inspected} /><dl className="periodic-electron-details"><div><dt>Shell distribution</dt><dd>{inspected.shells.join(" · ")}</dd></div><div><dt>Oxidation states</dt><dd>{inspected.oxidationStates.join(", ") || "Not available"}</dd></div></dl></>
      : <><dl className="periodic-property-list">{visibleProperties.map(key => <div key={key}><dt>{TREND_LABELS[key].label}</dt><dd>{formatProperty(inspected, key)}</dd></div>)}</dl><ShellDiagram element={inspected} /></>}
    </div>}
  </section>;
}

